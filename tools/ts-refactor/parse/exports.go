package parse

import (
	"fmt"
	"log"
	"runtime"
	"strings"
	"sync"

	sitter "github.com/smacker/go-tree-sitter"
)

type exportFlag uint8

const (
	EXPORT_NAMED       exportFlag = 1 << 0
	EXPORT_ALIAS       exportFlag = 1 << 1
	EXPORT_DEFAULT     exportFlag = 1 << 2
	EXPORT_NAMESPACE   exportFlag = 1 << 3
	EXPORT_SIDE_EFFECT exportFlag = 1 << 4
	EXPORT_TYPE        exportFlag = 1 << 5
	EXPORT_WILDCARD    exportFlag = 1 << 6
)

const (
	maxCpus = 10
)

type Exports []*Export

func (self Exports) Find(name string) *Export {
	for _, record := range self {
		if record.Name == name {
			return record
		}
	}

	return nil
}

func (self Exports) String() string {
	lines := []string{}
	for _, export := range self {
		lines = append(lines, "\t"+export.String())
	}
	return strings.Join(lines, "\n")
}

type CanonicalExport struct {
	// The canonical export source/index file for imports from a given package.
	canonicalFile *File
	// The original, component-level export.
	export *Export
}

type Export struct {
	Flags        exportFlag
	From         *File
	Location     *File
	Name         string
	OriginalName string
}

func (self Export) Is(flag exportFlag) bool {
	return self.Flags&flag == flag
}

func (self *Export) CanonicalizeV2(importingFile *File) *CanonicalExport {
	// TODO: Handle namespaced re-exports more comprehensively.
	if self.From != nil {
		return &CanonicalExport{canonicalFile: self.Location, export: self}
	}

	if importingFile.CanUseRelativeImport(self.Location) {
		return &CanonicalExport{canonicalFile: self.Location, export: self}
	}

	if strings.HasSuffix(self.Location.rootPath, "/index.ts") {
		return &CanonicalExport{canonicalFile: self.Location, export: self}
	}

	indexFile := self.Location.FindIndex()
	if indexFile == nil {
		return &CanonicalExport{canonicalFile: self.Location, export: self}
	}

	// If there's an index file in this package, consider all non-index
	// exports as package-private - search the index for a matching export:
	for _, indexReexport := range indexFile.exports {
		if indexReexport.From == self.Location &&
			indexReexport.Is(EXPORT_WILDCARD) {
			return &CanonicalExport{
				canonicalFile: indexReexport.Location,
				export:        self,
			}
		}

		if indexReexport.From == self.Location &&
			indexReexport.Name == self.Name {
			return &CanonicalExport{
				canonicalFile: indexReexport.Location,
				export:        indexReexport,
			}
		}
	}

	return nil
}

func (self *Export) Canonicalize(importingFile *File) *Export {
	// TODO: Handle namespaced re-exports more comprehensively.
	if self.From != nil {
		return self
	}

	if importingFile.CanUseRelativeImport(self.Location) {
		return self
	}

	if strings.HasSuffix(self.Location.rootPath, "/index.ts") {
		return self
	}

	indexFile := self.Location.FindIndex()
	if indexFile == nil {
		return self
	}

	// If there's an index file in this package, consider all non-index
	// exports as package-private - search the index for a matching export:
	for _, indexReexport := range indexFile.exports {
		if indexReexport.From == self.Location &&
			indexReexport.Is(EXPORT_WILDCARD) {
			return indexReexport
		}

		if indexReexport.From == self.Location &&
			indexReexport.Name == self.Name {
			return indexReexport
		}
	}

	return nil
}

func (self Export) String() string {
	flagList := []string{}
	if self.Is(EXPORT_ALIAS) {
		flagList = append(flagList, "🔗 alias")
	}
	if self.Is(EXPORT_DEFAULT) {
		flagList = append(flagList, "✅ default")
	}
	if self.Is(EXPORT_NAMED) {
		flagList = append(flagList, "🏷️  named")
	}
	if self.Is(EXPORT_NAMESPACE) {
		flagList = append(flagList, "📦 namespace")
	}
	if self.Is(EXPORT_TYPE) {
		flagList = append(flagList, "🛠️  type")
	}
	if self.Is(EXPORT_WILDCARD) {
		flagList = append(flagList, "*️⃣  wildcard")
	}

	return fmt.Sprintf(
		"%s'%s' - %s (from: %s)",
		flagList,
		self.Name,
		self.Location,
		self.From,
	)
}

func ProcessExports(repo *Repo, srcLoader SrcLoader) {
	repoFileChannel := make(chan *File)

	var wg sync.WaitGroup
	for i := range min(runtime.NumCPU()-1, maxCpus) {

		wg.Go(func() {

			for f := range repoFileChannel {
				err := processModuleExports(f, repo, srcLoader)

				if err != nil {
					fmt.Printf(
						"❌ [ export worker %d ] %s: %v\n", i, f.rootPath, err,
					)
					continue
				}
			}
		})

	}

	go func() {
		for f := range repo.Iter() {
			repoFileChannel <- f
		}

		close(repoFileChannel)
	}()

	wg.Wait()
}

func processModuleExports(
	file *File,
	repo *Repo,
	srcLoader SrcLoader,
) error {
	if strings.HasSuffix(file.rootPath, ".json") {
		file.RegisterExports(&Export{Flags: EXPORT_DEFAULT})
		return nil
	}

	src, err := srcLoader.LoadSrc(file)
	if err != nil {
		return err
	}
	defer src.Dispose()

	root := src.tree.RootNode()
	for i := range int(root.NamedChildCount()) {
		node := root.NamedChild(i)
		if node.Type() != "export_statement" {
			continue
		}

		importPathNode := node.ChildByFieldName("source")
		if importPathNode != nil {
			err := processReexport(node, importPathNode, src, repo)
			if err != nil {
				return nil
			}

			continue
		}

		declaration := node.ChildByFieldName("declaration")
		if declaration != nil {
			err := processDeclarationExport(node, declaration, src)
			if err != nil {
				return err
			}

			continue
		}

		if node.NamedChild(0).Type() == "export_clause" {
			err := processNamedExports(node, src)
			if err != nil {
				return err
			}

			continue
		}

		defaultValue := node.ChildByFieldName("value")
		defaultKeyword := node.Child(1)
		if defaultValue == nil || defaultKeyword == nil ||
			defaultKeyword.Content(src.Code()) != "default" {
			return fmt.Errorf(
				"expected s default export with a value node, got:\n"+
					"\t %s\n"+
					"\t %s\n",
				node,
				node.Content(src.Code()),
			)
		}

		src.file.RegisterExports(&Export{Flags: EXPORT_DEFAULT})
	}

	return nil
}

func processDeclarationExport(
	exportNode *sitter.Node,
	declaration *sitter.Node,
	src *Src,
) error {
	var name string
	var flags exportFlag

	optionalDefaultKeyword := exportNode.Child(1)
	if optionalDefaultKeyword.Content(src.Code()) == "default" {
		src.file.RegisterExports(&Export{Flags: EXPORT_DEFAULT})
		return nil
	}

	switch declaration.Type() {
	case "lexical_declaration":
		return processLexicalDeclarationExport(declaration, src)

	case "enum_declaration":
		flags = EXPORT_NAMED
		name = declaration.ChildByFieldName("name").Content(src.Code())

	case "function_signature":
		if !strings.HasSuffix(src.file.rootPath, ".d.ts") {
			// TS function overload - we only care about the real implementation.
			return nil
		}

		flags = EXPORT_NAMED
		name = declaration.ChildByFieldName("name").Content(src.Code())

	case "generator_function_declaration":
		fallthrough
	case "function_declaration":
		flags = EXPORT_NAMED
		name = declaration.ChildByFieldName("name").Content(src.Code())

	case "abstract_class_declaration":
		fallthrough
	case "class_declaration":
		flags = EXPORT_NAMED
		name = declaration.ChildByFieldName("name").Content(src.Code())

	case "type_alias_declaration":
		fallthrough
	case "interface_declaration":
		flags = EXPORT_NAMED | EXPORT_TYPE
		name = declaration.ChildByFieldName("name").Content(src.Code())

	default:
		return fmt.Errorf(
			"unhandled exported declaration type: %s",
			declaration.Type(),
		)
	}

	src.file.RegisterExports(&Export{
		Flags: flags,
		Name:  name,
	})

	return nil
}

func processLexicalDeclarationExport(
	declaration *sitter.Node,
	src *Src,
) error {
	variableDeclarator := declaration.NamedChild(0)
	nameNode := variableDeclarator.ChildByFieldName("name")

	switch nameNode.Type() {
	case "identifier":
		src.file.RegisterExports(&Export{
			Flags: EXPORT_NAMED,
			Name:  nameNode.Content(src.Code()),
		})
		return nil

	case "array_pattern":
		fallthrough
	case "object_pattern":
		for i := range int(nameNode.NamedChildCount()) {
			src.file.RegisterExports(&Export{
				Flags: EXPORT_NAMED,
				Name:  nameNode.NamedChild(i).Content(src.Code()),
			})
		}
		return nil

	default:
		return fmt.Errorf(
			"unhandled lexical declaration type: %s",
			nameNode.Type(),
		)
	}
}

func processNamedExports(
	exportNode *sitter.Node,
	src *Src,
) error {
	exportClause := exportNode.NamedChild(0)
	if exportClause.Type() != "export_clause" {
		return fmt.Errorf(
			"invalid named exports export node: %s\n"+
				"expected 'export_clause' child, got '%s'",
			exportNode,
			exportClause.Type(),
		)
	}

	namedExports, err := getNamedExports(exportClause, src)
	if err != nil {
		return err
	}

	optionalTypeKeyword := exportNode.Child(1)
	areAllTypeExports := optionalTypeKeyword.Content(src.Code()) == "type"
	for _, namedExport := range namedExports {
		if areAllTypeExports {
			namedExport.Flags |= EXPORT_TYPE
		}

		src.file.RegisterExports(namedExport)
	}

	return nil
}

func processReexport(
	exportNode *sitter.Node,
	importPathNode *sitter.Node,
	src *Src,
	allFiles *Repo,
) error {
	var importSource *File

	importPath := importPathNode.NamedChild(0).Content(src.Code())
	if IsInternalImport(importPath) {
		var err error
		importSource, err = src.file.ResolveImport(importPath, allFiles)

		if err != nil {
			return err
		}
	}

	if exportNode.NamedChildCount() == 1 {
		// Singular named child is the export `source` - expect wildcard export:
		nodeContent := exportNode.Content(src.Code())
		if !strings.HasPrefix(nodeContent, "export * from") {
			log.Fatalf(
				"expected single-named-child export node to be wildcard export: %s",
				nodeContent,
			)
		}

		src.file.RegisterExports(&Export{
			Flags: EXPORT_WILDCARD,
			From:  importSource,
		})

		return nil
	}

	for i := range int(exportNode.NamedChildCount()) {
		clause := exportNode.NamedChild(i)
		if clause == importPathNode {
			continue
		}

		switch clause.Type() {
		case "namespace_export":
			namespaceName := clause.NamedChild(0).Content(src.Code())
			src.file.RegisterExports(&Export{
				Flags: EXPORT_NAMESPACE,
				From:  importSource,
				Name:  namespaceName,
			})

		case "export_clause":
			namedExports, err := getNamedExports(clause, src)
			if err != nil {
				return err
			}

			optionalTypeKeyword := exportNode.Child(1)
			areAllTypeExports := optionalTypeKeyword.Content(
				src.Code(),
			) == "type"

			for _, namedExport := range namedExports {
				namedExport.From = importSource

				if areAllTypeExports {
					namedExport.Flags |= EXPORT_TYPE
				}

				src.file.RegisterExports(namedExport)
			}

		default:
			log.Fatalf("unhandled re-export type: %s\n", clause.Type())
		}
	}

	return nil
}

func getNamedExports(exportClause *sitter.Node, src *Src) (Exports, error) {
	if exportClause.Type() != "export_clause" {
		log.Fatalf(
			"invalid node type passed to getNamedExports: %s\n",
			exportClause.Type(),
		)
	}

	exports := Exports{}

	for i := range int(exportClause.NamedChildCount()) {
		specifierNode := exportClause.NamedChild(i)
		firstNode := specifierNode.Child(0)
		nameNode := specifierNode.ChildByFieldName("name")
		aliasNode := specifierNode.ChildByFieldName("alias")

		export := &Export{Flags: EXPORT_NAMED}
		if aliasNode != nil {
			export.Name = aliasNode.Content(src.Code())
			export.OriginalName = nameNode.Content(src.Code())
			export.Flags |= EXPORT_ALIAS
		} else {
			export.Name = nameNode.Content(src.Code())
		}

		if firstNode.Content(src.Code()) == "type" {
			export.Flags |= EXPORT_TYPE
		}

		exports = append(exports, export)
	}

	return exports, nil
}
