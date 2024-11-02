package ast

type nodeType = string

const (
	NODE_CALL_EXPRESSION      nodeType = "call_expression"
	NODE_EXPORT_CLAUSE        nodeType = "export_clause"
	NODE_EXPORT_STATEMENT     nodeType = "export_statement"
	NODE_EXPRESSION_STATEMENT nodeType = "expression_statement"
	NODE_IDENTIFIER           nodeType = "identifier"
	NODE_IMPORT_CLAUSE        nodeType = "import_clause"
	NODE_EXPORT_SPECIFIER     nodeType = "export_specifier"
	NODE_IMPORT_SPECIFIER     nodeType = "import_specifier"
	NODE_IMPORT_STATEMENT     nodeType = "import_statement"
	NODE_NAMED_EXPORTS        nodeType = "named_exports"
	NODE_NAMED_IMPORTS        nodeType = "named_imports"
	NODE_NAMESPACE_EXPORT     nodeType = "namespace_export"
	NODE_NAMESPACE_IMPORT     nodeType = "namespace_import"
)

type fieldName = string

const (
	FIELD_ALIAS        fieldName = "alias"
	FIELD_FN_ARGUMENTS fieldName = "arguments"
	FIELD_NAME         fieldName = "name"
)

type keyword = string

const (
	KEYWORD_TYPE   keyword = "type"
	KEYWORD_TYPEOF keyword = "typeof"
)
