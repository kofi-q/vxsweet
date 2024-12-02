package ts

import (
	"context"
	"os"
	"path"
	"slices"
	"strings"

	"github.com/kofi-q/vxsweet/tools/ts-refactor/ast"
	sitter "github.com/smacker/go-tree-sitter"
	"github.com/smacker/go-tree-sitter/typescript/tsx"
	"github.com/smacker/go-tree-sitter/typescript/typescript"
)

type ParseResult struct {
	Imports map[string]bool
	Modules []string
}

var (
	LangTs  = typescript.GetLanguage()
	LangTsx = tsx.GetLanguage()
)

var (
	testingLibraryMatches = [...]string{
		"toBeInTheDocument",
		"toBeDisabled",
		"toContainHTML",
		"toHaveAttribute",
		"toHaveStyle",
		"toHaveTextContent",
	}
	jestReferences = [...]string{
		"afterAll",
		"afterEach",
		"beforeAll",
		"beforeEach",
		"describe",
		"expect",
		"it",
		"test",
	}
	frequentNoWalkNodes = [...]string{
		"false",
		"jsx_text",
		"null",
		"number",
		"string",
		"this",
		"this_type",
		"true",
		"type_identifier",
		ast.NODE_COMMENT,
		ast.NODE_IDENTIFIER,
	}
)

type parser struct {
	code       []byte
	imports    map[string]bool
	isJestTest bool
	rootPath   string
	tree       *sitter.Tree
}

func newParser(rootDir, filePath string) *parser {
	return &parser{
		imports:  map[string]bool{},
		rootPath: path.Join(rootDir, filePath),
		isJestTest: !strings.HasPrefix(filePath, "libs/eslint-plugin-vx/tests") &&
			(strings.HasSuffix(filePath, ".test.ts") ||
				strings.HasSuffix(filePath, ".test.tsx")),
	}
}

func (self *parser) parse() (*ParseResult, []error) {
	var err error

	extension := path.Ext(self.rootPath)
	self.code, err = os.ReadFile(self.rootPath)
	if err != nil {
		return nil, []error{err}
	}

	lang := LangTs
	if extension == ".tsx" {
		lang = LangTsx

		self.imports["@types/react"] = true
		self.imports["react"] = true
	}

	if self.isJestTest {
		self.imports["@types/jest"] = true
	}

	parser := sitter.NewParser()
	parser.SetLanguage(lang)
	defer parser.Close()

	self.tree, err = parser.ParseCtx(context.Background(), nil, self.code)
	if err != nil {
		return nil, []error{err}
	}
	defer self.tree.Close()

	self.walkNode(self.tree.RootNode())

	return &ParseResult{
		Imports: self.imports,
		Modules: []string{},
	}, []error{}
}

func (self *parser) walkNode(root *sitter.Node) error {
	for i := range int(root.NamedChildCount()) {
		node := root.NamedChild(i)
		nodeType := node.Type()

		if slices.Contains(frequentNoWalkNodes[:], nodeType) {
			continue
		}

		switch nodeType {
		case ast.NODE_IMPORT_STATEMENT:
			if err := self.processImportNode(node); err != nil {
				return err
			}

		case ast.NODE_EXPORT_STATEMENT:
			if err := self.processImportNode(node); err != nil {
				return err
			}

		case ast.NODE_CALL_EXPRESSION:
			if err := self.processCallExpression(node); err != nil {
				return err
			}

		case ast.NODE_MEMBER_EXPRESSION:
			if err := self.processMemberExpression(node); err != nil {
				return err
			}

		case ast.NODE_PROPERTY_IDENTIFIER:
			if err := self.processPropertyIdentifier(node); err != nil {
				return err
			}

		case ast.NODE_NESTED_TYPE_IDENTIFIER:
			if err := self.processNestedTypeId(node); err != nil {
				return err
			}

		default:
			if err := self.walkNode(node); err != nil {
				return err
			}
		}
	}

	return nil
}

func (self *parser) processImportNode(node *sitter.Node) error {
	sourceNode := node.ChildByFieldName(ast.FIELD_IMPORT_EXPORT_SOURCE)
	if sourceNode == nil {
		return self.walkNode(node)
	}

	moduleNameOrPath := sourceNode.NamedChild(0).Content(self.code)
	return self.processImport(moduleNameOrPath)
}

func (self *parser) processImport(moduleNameOrPath string) error {
	self.imports[moduleNameOrPath] = true

	if moduleNameOrPath[0] == '.' || strings.HasPrefix(moduleNameOrPath, "@vx") {
		return nil
	}

	// TODO: Handle node imports without the `node:` prefix?
	if strings.HasPrefix(moduleNameOrPath, "node:") {
		self.imports["@types/node"] = true
		return nil
	}

	return self.processExternalImport(moduleNameOrPath)
}

func (self *parser) processExternalImport(moduleName string) error {
	switch moduleName {

	case "styled-components":
		self.imports["@types/styled-components"] = true
		self.imports["@vx/libs/ui/styled-components"] = true

	default:
		moduleNameParts := strings.Split(moduleName, "/")
		typesPackageName := moduleNameParts[0]

		if len(moduleNameParts) > 1 && strings.HasPrefix(moduleNameParts[0], "@") {
			typesPackageName = strings.TrimPrefix(
				strings.Join(moduleNameParts[:2], "__"),
				"@",
			)
		}

		self.imports["@types/"+typesPackageName] = true
	}

	return nil
}

func (self *parser) processCallExpression(node *sitter.Node) error {
	nameNode := node.ChildByFieldName("function")

	switch nameNode.Type() {
	case ast.NODE_IMPORT:
		argsNode := node.ChildByFieldName(ast.FIELD_FN_ARGUMENTS)
		sourceNode := argsNode.NamedChild(0)
		moduleNameOrPath := sourceNode.NamedChild(0).Content(self.code)

		self.imports[moduleNameOrPath] = true

	case ast.NODE_IDENTIFIER:
		if !self.hasPlaywrightImports() && !self.isJestTest {
			name := nameNode.Content(self.code)

			if slices.Contains(jestReferences[:], name) {
				self.imports["@types/jest"] = true
			}
		}
	}

	return self.walkNode(node)
}

func (self *parser) processMemberExpression(node *sitter.Node) error {
	objectNode := node.ChildByFieldName("object")
	if objectNode.Type() != ast.NODE_IDENTIFIER {
		return self.walkNode(node)
	}

	objectName := objectNode.Content(self.code)
	propertyNode := node.ChildByFieldName("property")

	switch objectName {
	case "jest":
		self.imports["@types/jest"] = true

		propertyName := propertyNode.Content(self.code)
		if propertyName == "mock" {
			return self.processJestMock(node.Parent())
		}

	case "process":
		self.imports["@types/node"] = true

		propertyName := propertyNode.Content(self.code)
		if propertyName == "env" {
			self.imports[ambientTypesImportEnv] = true
		}

	case "require":
		propertyName := propertyNode.Content(self.code)
		if propertyName == "resolve" {
			return self.processRequireResolve(node.Parent())
		}

	case "window":
		propertyName := propertyNode.Content(self.code)
		if propertyName == "kiosk" {
			self.imports[ambientTypesImportKioskBrowser] = true
		}
	}

	return nil
}

func (self *parser) processPropertyIdentifier(node *sitter.Node) error {
	if self.hasPlaywrightImports() {
		return nil
	}

	name := node.Content(self.code)
	if slices.Contains(testingLibraryMatches[:], name) {
		self.imports["@types/testing-library__jest-dom"] = true
		return nil
	}

	if name == "toHaveStyleRule" {
		self.imports[ambientTypesImportJestStyledComponents] = true
	}

	return nil
}

func (self *parser) processJestMock(node *sitter.Node) error {
	argsNode := node.ChildByFieldName(ast.FIELD_FN_ARGUMENTS)
	moduleNameOrPathNode := argsNode.NamedChild(0)
	moduleNameOrPath := moduleNameOrPathNode.NamedChild(0).Content(self.code)

	return self.processImport(moduleNameOrPath)
}

func (self *parser) processNestedTypeId(node *sitter.Node) error {
	moduleName := node.ChildByFieldName("module").Content(self.code)

	switch moduleName {
	case "jest":
		self.imports["@types/jest"] = true

	case "KioskBrowser":
		self.imports[ambientTypesImportKioskBrowser] = true

	case "JSX":
		self.imports["@types/react"] = true

	case "NodeJS":
		self.imports["@types/node"] = true
	}

	return nil
}

func (self *parser) processRequireResolve(node *sitter.Node) error {
	argsNode := node.ChildByFieldName(ast.FIELD_FN_ARGUMENTS)
	moduleNameOrPathNode := argsNode.NamedChild(0)
	moduleNameOrPath := moduleNameOrPathNode.NamedChild(0).Content(self.code)

	return self.processImport(moduleNameOrPath)
}

func (self *parser) hasPlaywrightImports() bool {
	_, hasPlaywrightImports := self.imports["@playwright/test"]
	return hasPlaywrightImports
}
