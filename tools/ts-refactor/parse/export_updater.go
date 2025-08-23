package parse

import (
	"fmt"
	"strings"

	sitter "github.com/smacker/go-tree-sitter"
)

// TODO: Reminder - copy-paste of `importUpdater`. Need to merge query logic
// with exports.go.

type namedExportRecord struct {
	alias  string
	isType bool
	name   string
}

type namespaceExportRecord struct {
	name   string
	isType bool
}

func (self namedExportRecord) String() string {
	if self.alias == "" {
		return self.name
	}

	return fmt.Sprintf("%s as %s", self.name, self.alias)
}

type exportGroupMap map[*File]*exportGroup

func (self exportGroupMap) has(source *File) bool {
	_, exists := self[source]
	return exists
}

type exportGroup struct {
	defaultExport    string
	exportingFile    *File
	namedExports     []namedExportRecord
	namespaceExports []string
	from             *File
}

func (self exportGroup) String() string {
	return strings.Join(
		append(self.namespaceStrings(), self.componentsStrings()...),
		"\n",
	)
}

func (self exportGroup) componentsStrings() []string {
	singleLineClauses := []string{}
	multiLineClauses := []string{}

	singleLineNamedExports := self.namedExportsClause(false)
	if len(singleLineNamedExports) > 0 {
		singleLineClauses = append(singleLineClauses, singleLineNamedExports)

		multiLineNamedExports := self.namedExportsClause(true)
		multiLineClauses = append(multiLineClauses, multiLineNamedExports)
	}

	if len(singleLineClauses) == 0 {
		return []string{}
	}

	singleLineOutput := fmt.Sprintf(
		"export %s from '%s';",
		strings.Join(singleLineClauses, ", "),
		self.from.ImportPath(self.exportingFile),
	)

	if len(singleLineOutput) <= CHARS_PER_LINE_MAX {
		return []string{singleLineOutput}
	}

	return []string{fmt.Sprintf(
		"export %s from '%s';",
		strings.Join(multiLineClauses, ", "),
		self.from.ImportPath(self.exportingFile),
	)}
}

func (self exportGroup) defaultExportsClause() string {
	if len(self.defaultExport) == 0 {
		return ""
	}

	return fmt.Sprintf("%s", self.defaultExport)
}

func (self exportGroup) namedExportsClause(multiLine bool) string {
	if len(self.namedExports) == 0 {
		return ""
	}

	namedExportStringList := []string{}
	for _, imp := range self.namedExports {
		prefix := ""
		if imp.isType {
			prefix = "type "
		}

		namedExportStringList = append(
			namedExportStringList,
			prefix+imp.String(),
		)
	}

	if multiLine {
		return fmt.Sprintf(
			"{\n  %s,\n}",
			strings.Join(namedExportStringList, ",\n  "),
		)
	}

	return fmt.Sprintf(
		"{ %s }",
		strings.Join(namedExportStringList, ", "),
	)
}

func (self exportGroup) namespaceStrings() []string {
	if len(self.namespaceExports) == 0 {
		return []string{}
	}

	exportStringList := []string{}
	for _, name := range self.namespaceExports {
		exportStringList = append(exportStringList, fmt.Sprintf(
			"export * as %s from '%s';",
			name,
			self.from.ImportPath(self.exportingFile),
		))
	}

	return exportStringList
}

type wildcardExport struct {
	exportedFile  *File
	exportingFile *File
}

func (self wildcardExport) String() string {
	return fmt.Sprintf(
		"export * from '%s';",
		self.exportedFile.ImportPath(self.exportingFile),
	)
}

type ExportUpdater struct {
	groups exportGroupMap
	repo   *Repo
	src    *Src
}

func NewExportUpdater(src *Src, repo *Repo) *ExportUpdater {
	return &ExportUpdater{
		groups: exportGroupMap{},
		repo:   repo,
		src:    src,
	}
}

func (self *ExportUpdater) Update(
	exportStatement *sitter.Node,
) (OutputChunkList, error) {
	exportPathNode := exportStatement.ChildByFieldName("source")
	if exportPathNode == nil {
		return OutputChunkList{
			exportStatement.Content(self.src.Code()),
			"\n",
		}, nil
	}

	exportPath := strings.Trim(exportPathNode.Content(self.src.Code()), "'\"")
	if !IsInternalImport(exportPath) {
		return OutputChunkList{
			exportStatement.Content(self.src.Code()),
			"\n",
		}, nil
	}

	exportedFile, err := self.src.File().ResolveImport(exportPath, self.repo)
	if err != nil {
		return nil, err
	}

	outputChunks := OutputChunkList{}

	if exportStatement.NamedChildCount() == 1 {
		outputChunks.Push(&wildcardExport{
			exportedFile:  exportedFile,
			exportingFile: self.src.File(),
		}, "\n")

		return outputChunks, nil
	}

	namespaceExport, err := findNamespaceExport(exportStatement, self.src)
	if err != nil {
		return nil, err
	}

	if len(namespaceExport) > 0 {
		// TODO: Loop through transitive exports and figure out whether the
		// namespace is still valid for all exports used in the file.
		// Need to split up those namespaces and update the references.
		namespaceSource := exportedFile
		group, exists := self.groups[namespaceSource]
		if !exists {
			group = &exportGroup{
				from:          namespaceSource,
				exportingFile: self.src.File(),
			}
			self.groups[namespaceSource] = group

			outputChunks.Push(group, "\n")
		}

		group.namespaceExports = append(
			group.namespaceExports,
			namespaceExport,
		)

		return outputChunks, nil
	}

	namedExports, err := findNamedExports(exportStatement, self.src)
	if err != nil {
		return nil, err
	}

	for _, namedExport := range namedExports {
		matchingExport := exportedFile.FindNamedExport(namedExport.name)
		if matchingExport == nil {
			return nil, fmt.Errorf(
				"expected named export '%s' not found in exports for %s\n",
				namedExport,
				exportPath,
			)
		}

		if matchingExport.Is(EXPORT_TYPE) {
			namedExport.isType = true
		}

		canonicalExport := matchingExport.Canonicalize(self.src.File())
		if canonicalExport == nil {
			fmt.Println(matchingExport, self.src.File())
		}
		group, hasExistingGroup := self.groups[canonicalExport.Location]
		if !hasExistingGroup {
			group = &exportGroup{
				exportingFile: self.src.File(),
				from:          canonicalExport.Location,
			}
			self.groups[canonicalExport.Location] = group

			outputChunks.Push(group, "\n")
		}

		group.namedExports = append(group.namedExports, namedExport)
	}

	return outputChunks, nil
}
