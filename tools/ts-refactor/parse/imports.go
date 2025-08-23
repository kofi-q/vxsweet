package parse

import (
	"fmt"
	"log"
	"strings"

	sitter "github.com/smacker/go-tree-sitter"
)

const (
	CHARS_PER_LINE_MAX = 80
)

type namedImportRecord struct {
	alias  string
	isType bool
	name   string
}

type namespaceImportRecord struct {
	name   string
	isType bool
}

func (self namedImportRecord) String() string {
	if self.alias == "" {
		return self.name
	}

	return fmt.Sprintf("%s as %s", self.name, self.alias)
}

type importGroupMap map[*File]*importGroup

func (self importGroupMap) has(source *File) bool {
	_, exists := self[source]
	return exists
}

type importGroup struct {
	defaultImport    string
	importingFile    *File
	namedImports     []namedImportRecord
	namespaceImports []string
	from             *File
}

func (self importGroup) String() string {
	return strings.Join(
		append(self.namespaceStrings(), self.componentsStrings()...),
		"\n",
	)
}

func (self importGroup) componentsStrings() []string {
	singleLineClauses := []string{}
	multiLineClauses := []string{}
	numComponents := len(self.namedImports)

	defaultClause := self.defaultImportsClause()
	if len(defaultClause) > 0 {
		numComponents += 1
		singleLineClauses = append(singleLineClauses, defaultClause)
		multiLineClauses = append(multiLineClauses, defaultClause)
	}

	singleLineNamedImports := self.namedImportsClause(false)
	if len(singleLineNamedImports) > 0 {
		singleLineClauses = append(singleLineClauses, singleLineNamedImports)

		multiLineNamedImports := self.namedImportsClause(true)
		multiLineClauses = append(multiLineClauses, multiLineNamedImports)
	}

	if len(singleLineClauses) == 0 {
		return []string{}
	}

	singleLineOutput := fmt.Sprintf(
		"import %s from '%s';",
		strings.Join(singleLineClauses, ", "),
		self.from.ImportPath(self.importingFile),
	)

	if len(singleLineOutput) <= CHARS_PER_LINE_MAX || numComponents <= 1 {
		return []string{singleLineOutput}
	}

	return []string{fmt.Sprintf(
		"import %s from '%s';",
		strings.Join(multiLineClauses, ", "),
		self.from.ImportPath(self.importingFile),
	)}
}

func (self importGroup) defaultImportsClause() string {
	if len(self.defaultImport) == 0 {
		return ""
	}

	return fmt.Sprintf("%s", self.defaultImport)
}

func (self importGroup) namedImportsClause(multiLine bool) string {
	if len(self.namedImports) == 0 {
		return ""
	}

	namedImportStringList := []string{}
	for _, imp := range self.namedImports {
		prefix := ""
		if imp.isType {
			prefix = "type "
		}

		namedImportStringList = append(
			namedImportStringList,
			prefix+imp.String(),
		)
	}

	if multiLine {
		return fmt.Sprintf(
			"{\n  %s,\n}",
			strings.Join(namedImportStringList, ",\n  "),
		)
	}

	return fmt.Sprintf(
		"{ %s }",
		strings.Join(namedImportStringList, ", "),
	)
}

func (self importGroup) namespaceStrings() []string {
	if len(self.namespaceImports) == 0 {
		return []string{}
	}

	importStringList := []string{}
	for _, name := range self.namespaceImports {
		importStringList = append(importStringList, fmt.Sprintf(
			"import * as %s from '%s';",
			name,
			self.from.ImportPath(self.importingFile),
		))
	}

	return importStringList
}

type sideEffectImport struct {
	importingFile *File
	importedFile  *File
}

func (self sideEffectImport) String() string {
	return fmt.Sprintf(
		"import '%s';",
		self.importedFile.ImportPath(self.importingFile),
	)
}

type ImportUpdater struct {
	groups importGroupMap
	repo   *Repo
	src    *Src
}

func NewImportUpdater(src *Src, repo *Repo) *ImportUpdater {
	return &ImportUpdater{
		groups: importGroupMap{},
		repo:   repo,
		src:    src,
	}
}

func (self *ImportUpdater) Update(
	importStatement *sitter.Node,
) (OutputChunkList, error) {
	importPathNode := importStatement.ChildByFieldName("source")
	if importPathNode == nil {
		log.Panicln(
			"🚨 unhandled/unexpected import statement format:",
			self.src.file.rootPath,
			"[", importStatement.Content(self.src.Code()), "]",
		)
	}

	importPath := strings.Trim(importPathNode.Content(self.src.Code()), "'\"")
	if !IsInternalImport(importPath) {
		return OutputChunkList{
			importStatement.Content(self.src.Code()),
			"\n",
		}, nil
	}

	importedFile, err := self.src.File().ResolveImport(importPath, self.repo)
	if err != nil {
		return nil, err
	}

	outputChunks := OutputChunkList{}

	if importStatement.NamedChildCount() == 1 {
		outputChunks.Push(&sideEffectImport{
			importedFile:  importedFile,
			importingFile: self.src.File(),
		}, "\n")

		return outputChunks, nil
	}

	namespaceImport, err := findNamespaceImport(importStatement, self.src)
	if err != nil {
		return nil, err
	}

	if len(namespaceImport) > 0 {
		// TODO: Loop through transitive exports and figure out whether the
		// namespace is still valid for all exports used in the file.
		// Need to split up those namespaces and update the references.
		namespaceSource := importedFile
		group, exists := self.groups[namespaceSource]
		if !exists {
			group = &importGroup{
				from:          namespaceSource,
				importingFile: self.src.File(),
			}
			self.groups[namespaceSource] = group

			outputChunks.Push(group, "\n")
		}

		group.namespaceImports = append(
			group.namespaceImports,
			namespaceImport,
		)

		return outputChunks, nil
	}

	defaultImport, err := findDefaultImport(importStatement, self.src)
	if err != nil {
		return nil, err
	}

	if len(defaultImport) > 0 {
		matchingExport := importedFile.FindDefaultExport()
		if matchingExport == nil {
			return nil, fmt.Errorf(
				"expected default import not found in exports for %s\n",
				importPath,
			)
		}

		group, exists := self.groups[matchingExport.Location]
		if !exists {
			group = &importGroup{
				importingFile: self.src.File(),
				from:          matchingExport.Location,
			}
			self.groups[matchingExport.Location] = group

			outputChunks.Push(group, "\n")
		} else if group.defaultImport != "" &&
			group.defaultImport != defaultImport {
			return nil, fmt.Errorf(
				"potential duplicate default import from %s: %s <> %s",
				matchingExport.Location,
				defaultImport,
				group.defaultImport,
			)
		}

		group.defaultImport = defaultImport
	}

	namedImports, err := findNamedImports(importStatement, self.src)
	if err != nil {
		return nil, err
	}

	for _, namedImport := range namedImports {
		matchingExport := importedFile.FindNamedExport(namedImport.name)
		if matchingExport == nil {
			return nil, fmt.Errorf(
				"expected named import '%s' not found in exports for %s\n",
				namedImport,
				importPath,
			)
		}

		if matchingExport.Is(EXPORT_TYPE) {
			namedImport.isType = true
		}

		canonicalExport := matchingExport.Canonicalize(self.src.File())
		if canonicalExport == nil {
			fmt.Println(matchingExport, self.src.File())
		}
		group, hasExistingGroup := self.groups[canonicalExport.Location]
		if !hasExistingGroup {
			group = &importGroup{
				importingFile: self.src.File(),
				from:          canonicalExport.Location,
			}
			self.groups[canonicalExport.Location] = group

			outputChunks.Push(group, "\n")
		}

		group.namedImports = append(group.namedImports, namedImport)
	}

	return outputChunks, nil
}
