package parse

import (
	"fmt"
	"log"
	"maps"
	"slices"
	"strings"

	"github.com/kofi-q/vxsweet/tools/ts-refactor/ast"
	sitter "github.com/smacker/go-tree-sitter"
)

type jestmockComponent interface {
}

type namedJestMockRecord struct {
	alias  string
	isType bool
	name   string
}

type namespaceJestMockRecord struct {
	name   string
	isType bool
}

func (self namedJestMockRecord) String() string {
	if self.alias == "" {
		return self.name
	}

	return fmt.Sprintf("%s as %s", self.name, self.alias)
}

type jestMocFactoryMap map[*File]*jestMockFactory

func (self jestMocFactoryMap) has(source *File) bool {
	_, exists := self[source]
	return exists
}

type jestMockFactory struct {
	body          *OutputChunkList
	hasReturnType bool
	isAuto        bool
	isBlock       bool
	mockedFile    *File
	returnObject  *OutputChunkList
	sourceFile    *File
}

func (self *jestMockFactory) String() string {
	importPath := self.mockedFile.ImportPath(self.sourceFile)

	if self.isAuto {
		return fmt.Sprintf("jest.mock('%s');", importPath)
	}

	returnTypeString := ""
	if self.hasReturnType {
		returnTypeString = fmt.Sprintf(`: typeof import('%s')`, importPath)
	}

	topLineSample := fmt.Sprintf(
		`jest.mock('%s', ()%s => `,
		importPath,
		returnTypeString,
	)
	factoryOpeningCharCount := 2
	if self.isBlock {
		factoryOpeningCharCount = 1
	}
	isTopLineSplit := len(
		topLineSample,
	)+factoryOpeningCharCount > CHARS_PER_LINE_MAX

	returnObjectIndent := "  "
	if self.isBlock {
		returnObjectIndent += "  "
	}
	if isTopLineSplit {
		returnObjectIndent += "  "
	}

	functionBlockBody := ""
	for _, chunk := range *self.body {
		if _, ok := chunk.(jestRequireActualUnresolved); ok {
			functionBlockBody += fmt.Sprint(jestRequireActual{
				sourceFile: self.sourceFile,
				targetFile: self.mockedFile,
			})
		} else {
			functionBlockBody += fmt.Sprint(chunk)
		}
	}

	returnObjectBody := ""
	for _, chunk := range *self.returnObject {
		returnObjectBody += fmt.Sprint(returnObjectIndent, chunk)
	}
	returnObjectBody = fmt.Sprintf(
		"{\n%s%s}",
		returnObjectBody,
		returnObjectIndent[2:],
	)

	factoryBlockIndent := ""
	if isTopLineSplit {
		factoryBlockIndent = "  "
	}

	factory := ""
	if self.isBlock {
		factory = strings.Join([]string{
			`{`,
			functionBlockBody + `return ` + returnObjectBody + `;`,
			factoryBlockIndent + `}`,
		}, "\n")
	} else {
		factory = fmt.Sprintf(`(%s)`, returnObjectBody)
	}

	if isTopLineSplit {
		return fmt.Sprintf(
			"jest.mock(\n  '%s',\n  ()%s => %s\n);",
			importPath,
			returnTypeString,
			factory,
		)
	}

	return fmt.Sprintf(
		`jest.mock('%s', ()%s => %s);`,
		importPath,
		returnTypeString,
		factory,
	)
}

type jestRequireActualUnresolved struct{}

type jestRequireActual struct {
	isSpread   bool
	sourceFile *File
	targetFile *File
}

func (self jestRequireActual) String() string {
	prefix := ""
	if self.isSpread {
		prefix = "..."
	}

	return fmt.Sprintf(
		`%sjest.requireActual('%s')`,
		prefix,
		self.targetFile.ImportPath(self.sourceFile),
	)
}

type JestMockUpdater struct {
	groups jestMocFactoryMap
	repo   *Repo
	src    *Src
}

func NewJestMockUpdater(src *Src, repo *Repo) *JestMockUpdater {
	return &JestMockUpdater{
		groups: jestMocFactoryMap{},
		repo:   repo,
		src:    src,
	}
}

func (self *JestMockUpdater) Update(
	expressionStatement *sitter.Node,
) (OutputChunkList, error) {
	jestMockExpression := expressionStatement.NamedChild(0)
	if jestMockExpression.Type() != ast.NODE_CALL_EXPRESSION {
		log.Panicf(
			"invalid jest mock node type - expected %s, got %s",
			ast.NODE_CALL_EXPRESSION,
			jestMockExpression.Type(),
		)
	}

	outputChunks := OutputChunkList{}

	args := jestMockExpression.ChildByFieldName(ast.FIELD_FN_ARGUMENTS)
	importPath := strings.Trim(
		args.NamedChild(0).Content(self.src.Code()),
		"'\"",
	)
	if !IsInternalImport(importPath) {
		return OutputChunkList{
			expressionStatement.Content(self.src.Code()),
			"\n",
		}, nil
	}

	mockedFile, err := self.src.File().ResolveImport(importPath, self.repo)
	if err != nil {
		return nil, err
	}

	transitiveExports := mockedFile.TransitiveExports()
	canonicalExports := map[*File][]*CanonicalExport{}
	for _, export := range transitiveExports {
		canonicalExport := export.CanonicalizeV2(self.src.File())
		if canonicalExport == nil {
			continue
		}

		canonicalExports[canonicalExport.canonicalFile] = append(
			canonicalExports[canonicalExport.canonicalFile],
			canonicalExport,
		)
	}

	if args.NamedChildCount() == 1 {
		sortedFiles := slices.SortedFunc(
			maps.Keys(canonicalExports),
			func(a *File, b *File) int {
				return strings.Compare(a.rootPath, b.rootPath)
			},
		)

		for _, newMockedFile := range sortedFiles {
			group, exists := self.groups[newMockedFile]
			if !exists {
				group = &jestMockFactory{
					isAuto:     true,
					mockedFile: newMockedFile,
					sourceFile: self.src.file,
				}
				self.groups[newMockedFile] = group

				outputChunks.Push(group, "\n")
			}
		}

		return outputChunks, nil
	}

	factory := args.NamedChild(1)

	hasReturnType := factory.ChildByFieldName("return_type") != nil
	factoryBody := factory.ChildByFieldName("body")

	switch factoryBody.Type() {
	case "parenthesized_expression":
		objectNode := factoryBody.NamedChild(0)
		return self.parseReturnObject(objectNode, canonicalExports, hasReturnType)
	case "statement_block":
		return self.parseFactoryFunctionBlock(
			factoryBody,
			canonicalExports,
			hasReturnType,
		)
	}

	return outputChunks, nil
}

func (self *JestMockUpdater) parseFactoryFunctionBlock(
	blockNode *sitter.Node,
	canonicalExports map[*File][]*CanonicalExport,
	hasReturnType bool,
) (OutputChunkList, error) {
	srcReader := self.src.NewReader()
	// Nudge the cursor by 2 bytes to skip opening brace and newline.
	if err := srcReader.Seek(int(blockNode.StartByte() + 2)); err != nil {
		return nil, err
	}

	outputChunks := OutputChunkList{}
	bodyChunks := OutputChunkList{}

	for i := range int(blockNode.NamedChildCount()) {
		blockChild := blockNode.NamedChild(i)

		nonCodeChunk, err := srcReader.ReadTo(int(blockChild.StartByte()))
		if err != nil {
			return nil, err
		}
		bodyChunks.Push(nonCodeChunk)

		switch blockChild.Type() {
		case "lexical_declaration":
			declarationChunks, err := self.parseDeclaration(blockChild)
			if err != nil {
				return nil, err
			}

			bodyChunks.Push(declarationChunks...)

		case "return_statement":
			chunks, err := self.parseReturnObject(
				blockChild.NamedChild(0),
				canonicalExports,
				hasReturnType,
			)
			if err != nil {
				return nil, err
			}

			outputChunks.Push(chunks...)

		default:
			bodyChunks.Push(blockChild.Content(self.src.Code()))
		}

		if err := srcReader.Seek(int(blockChild.EndByte())); err != nil {
			return nil, err
		}
	}

	for file := range canonicalExports {
		if mockGroup, exists := self.groups[file]; exists {
			mockGroup.body.Push(bodyChunks...)
			mockGroup.isBlock = true
			mockGroup.hasReturnType = hasReturnType
		}
	}

	return outputChunks, nil
}

func (self *JestMockUpdater) parseDeclaration(
	declarationNode *sitter.Node,
) (OutputChunkList, error) {
	srcReader := self.src.NewReader()
	if err := srcReader.Seek(int(declarationNode.StartByte())); err != nil {
		return nil, err
	}

	valueNode := declarationNode.NamedChild(0).ChildByFieldName("value")
	if valueNode.Type() != ast.NODE_CALL_EXPRESSION {
		return OutputChunkList{declarationNode.Content(self.src.Code())}, nil
	}

	functionNameNode := valueNode.ChildByFieldName("function")
	functionName := functionNameNode.Content(self.src.Code())
	if functionName != "jest.requireActual" {
		return OutputChunkList{declarationNode.Content(self.src.Code())}, nil
	}

	outputChunks := OutputChunkList{}

	prefixChunk, err := srcReader.ReadTo(int(valueNode.StartByte()))
	if err != nil {
		return nil, err
	}
	outputChunks.Push(prefixChunk)

	outputChunks.Push(jestRequireActualUnresolved{})

	if err := srcReader.Seek(int(valueNode.EndByte())); err != nil {
		return nil, err
	}
	suffixChunk, err := srcReader.ReadTo(int(declarationNode.EndByte()))
	if err != nil {
		return nil, err
	}
	outputChunks.Push(suffixChunk)

	return outputChunks, nil
}

func (self *JestMockUpdater) parseReturnObject(
	objectNode *sitter.Node,
	canonicalExports map[*File][]*CanonicalExport,
	hasReturnType bool,
) (OutputChunkList, error) {
	srcReader := self.src.NewReader()
	if err := srcReader.Seek(int(objectNode.StartByte())); err != nil {
		return nil, err
	}

	filesWithMockedExports := []*File{}

	type returnObjectChunkGroup struct {
		chunks        *OutputChunkList
		isPreExisting bool
	}
	chunkGroups := map[*File]*returnObjectChunkGroup{}
	for file := range self.groups {
		chunkGroups[file] = &returnObjectChunkGroup{
			chunks:        self.groups[file].returnObject,
			isPreExisting: true,
		}
	}

	var fieldNode *sitter.Node
	for i := range int(objectNode.NamedChildCount()) {
		fieldNode = objectNode.NamedChild(i)

		for file, exports := range canonicalExports {
			chunkGroup, isExistingGroup := chunkGroups[file]
			if !isExistingGroup {
				chunkGroup = &returnObjectChunkGroup{chunks: &OutputChunkList{}}
				chunkGroups[file] = chunkGroup
			}

			switch fieldNode.Type() {
			case "spread_element":
				if !chunkGroup.isPreExisting {
					chunkGroup.chunks.Push(
						fmt.Sprint(
							self.parseSpreadElement(fieldNode, file),
							",\n",
						),
					)
				}

			case "pair":
				name := fieldNode.ChildByFieldName("key").Content(self.src.Code())
				isExportedByFile := slices.ContainsFunc(
					exports,
					func(e *CanonicalExport) bool {
						return e.export.Name == name
					},
				)

				if isExportedByFile {
					chunkGroup.chunks.Push(fieldNode.Content(self.src.Code()) + ",\n")

					if !slices.Contains(filesWithMockedExports, file) {
						filesWithMockedExports = append(
							filesWithMockedExports,
							file,
						)
					}
				}

			case "method_definition":
				name := fieldNode.ChildByFieldName("name").Content(self.src.Code())
				isExportedByFile := slices.ContainsFunc(
					exports,
					func(e *CanonicalExport) bool {
						return e.export.Name == name
					},
				)

				if isExportedByFile {
					chunkGroup.chunks.Push(fieldNode.Content(self.src.Code()) + ",\n")

					if !slices.Contains(filesWithMockedExports, file) {
						filesWithMockedExports = append(
							filesWithMockedExports,
							file,
						)
					}
				}

			case "comment":
				chunkGroup.chunks.Push(fieldNode.Content(self.src.Code()) + "\n")

			default:
				log.Panicf(
					"unhandled mock return object field type %s in %s",
					fieldNode.Type(),
					self.src.file,
				)
			}
		}
	}

	outputChunks := OutputChunkList{}
	for _, file := range filesWithMockedExports {
		mockGroup, alreadyExists := self.groups[file]
		if !alreadyExists {
			mockGroup = &jestMockFactory{
				body:          &OutputChunkList{},
				returnObject:  &OutputChunkList{},
				hasReturnType: hasReturnType,
				isBlock:       false,
				mockedFile:    file,
				sourceFile:    self.src.File(),
			}

			self.groups[file] = mockGroup
			outputChunks.Push(mockGroup, "\n")
		}
		mockGroup.isAuto = false
		mockGroup.returnObject = chunkGroups[file].chunks
	}

	return outputChunks, nil
}

func (self *JestMockUpdater) parseSpreadElement(
	spreadElement *sitter.Node,
	mockedFile *File,
) any {
	firstChild := spreadElement.NamedChild(0)

	switch firstChild.Type() {
	case ast.NODE_IDENTIFIER:
		return spreadElement.Content(self.src.Code())
	case ast.NODE_CALL_EXPRESSION:
		fnName := firstChild.ChildByFieldName("function").
			Content(self.src.Code())

		if fnName != "jest.requireActual" {
			return spreadElement.Content(self.src.Code())
		}

		return &jestRequireActual{
			isSpread:   true,
			sourceFile: self.src.File(),
			targetFile: mockedFile,
		}
	default:
		log.Panicf("unhandled spread element type: %s\n", firstChild.Type())
	}

	return OutputChunkList{}
}
