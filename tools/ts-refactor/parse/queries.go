package parse

import (
	"fmt"
	"log"

	"github.com/kofi-q/vxsweet/tools/ts-refactor/ast"
	sitter "github.com/smacker/go-tree-sitter"
)

func findNamedImports(
	importStatement *sitter.Node,
	src *Src,
) ([]namedImportRecord, error) {
	results := []namedImportRecord{}

	importClause := importStatement.NamedChild(0)
	if importClause.Type() != ast.NODE_IMPORT_CLAUSE {
		return results, nil
	}

	for subClauseIdx := range int(importClause.NamedChildCount()) {
		namedImportsClause := importClause.NamedChild(subClauseIdx)
		if namedImportsClause.Type() != ast.NODE_NAMED_IMPORTS {
			continue
		}

		areAllTypeImports := false
		possibleOuterTypeTag := importStatement.Child(1)
		if possibleOuterTypeTag.Content(src.Code()) == ast.KEYWORD_TYPE {
			areAllTypeImports = true
		}

		for specifierIdx := range int(namedImportsClause.NamedChildCount()) {
			importSpecifier := namedImportsClause.NamedChild(specifierIdx)
			if importSpecifier.Type() != ast.NODE_IMPORT_SPECIFIER {
				continue
			}

			nameNode := importSpecifier.ChildByFieldName(ast.FIELD_NAME)
			if nameNode == nil {
				log.Panicf(
					"no name node found in named import specifier clause: %s",
					importSpecifier,
				)
			}

			name := nameNode.Content(src.Code())

			alias := ""
			aliasNode := importSpecifier.ChildByFieldName(ast.FIELD_ALIAS)
			if aliasNode != nil {
				alias = aliasNode.Content(src.Code())
			}

			possibleInnerTypeTag := importSpecifier.Child(0)
			isTypeImport := possibleInnerTypeTag.Content(
				src.Code(),
			) == ast.KEYWORD_TYPE

			results = append(results, namedImportRecord{
				alias:  alias,
				isType: areAllTypeImports || isTypeImport,
				name:   name,
			})
		}
	}

	return results, nil
}

func findDefaultImport(
	importStatement *sitter.Node,
	file *Src,
) (string, error) {
	importClause := importStatement.NamedChild(0)
	if importClause.Type() != ast.NODE_IMPORT_CLAUSE {
		return "", nil
	}

	identifier := importClause.NamedChild(0)
	if identifier.Type() != ast.NODE_IDENTIFIER {
		return "", nil
	}

	return identifier.Content(file.Code()), nil
}

func findNamespaceImport(
	importStatement *sitter.Node,
	file *Src,
) (string, error) {
	importClause := importStatement.NamedChild(0)
	if importClause.Type() != ast.NODE_IMPORT_CLAUSE {
		return "", nil
	}

	namespaceClause := importClause.NamedChild(0)
	if namespaceClause.Type() != ast.NODE_NAMESPACE_IMPORT {
		return "", nil
	}

	identifier := namespaceClause.NamedChild(0)
	if identifier.Type() != ast.NODE_IDENTIFIER {
		return "", nil
	}

	return identifier.Content(file.Code()), nil
}

func findNamedExports(
	exportStatement *sitter.Node,
	src *Src,
) ([]namedExportRecord, error) {
	results := []namedExportRecord{}

	exportClause := exportStatement.NamedChild(0)
	if exportClause.Type() != ast.NODE_EXPORT_CLAUSE {
		return results, nil
	}

	exports, err := getNamedExports(exportClause, src)
	if err != nil {
		return nil, err
	}

	for _, export := range exports {
		result := namedExportRecord{
			isType: export.Is(EXPORT_TYPE),
			name:   export.Name,
		}

		if export.Is(EXPORT_ALIAS) {
			result.name = export.OriginalName
			result.alias = export.Name
		}

		results = append(results, result)
	}

	return results, nil
}

func findNamespaceExport(
	exportStatement *sitter.Node,
	file *Src,
) (string, error) {
	namespaceClause := exportStatement.NamedChild(0)
	if namespaceClause.Type() != ast.NODE_NAMESPACE_EXPORT {
		return "", nil
	}

	identifier := namespaceClause.NamedChild(0)
	if identifier.Type() != ast.NODE_IDENTIFIER {
		fmt.Println(identifier)
		return "", nil
	}

	return identifier.Content(file.Code()), nil
}
