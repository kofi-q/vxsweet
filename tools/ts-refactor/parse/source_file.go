package parse

import (
	"context"
	"log"
	"os"
	"path"

	sitter "github.com/smacker/go-tree-sitter"
	"github.com/smacker/go-tree-sitter/typescript/tsx"
	"github.com/smacker/go-tree-sitter/typescript/typescript"
)

var (
	LangTs  = typescript.GetLanguage()
	LangTsx = tsx.GetLanguage()
)

type Src struct {
	code []byte
	file *File
	lang *sitter.Language
	tree *sitter.Tree
}

func (self *Src) Dispose() {
	self.tree.Close()
}

func (self Src) Code() []byte {
	return self.code
}

func (self Src) Lang() *sitter.Language {
	return self.lang
}

func (self Src) File() *File {
	return self.file
}

func (self Src) RootNode() sitter.Node {
	return *self.tree.RootNode()
}

func (self Src) NewReader() *Reader {
	return &Reader{
		file: &self,
		pos:  0,
	}
}

type SrcLoader interface {
	LoadSrc(file *File) (*Src, error)
}

type FsSrcLoader struct{}

func (self FsSrcLoader) LoadSrc(file *File) (*Src, error) {
	return ParseSrc(file, readRepoFile(file))
}

func ParseSrc(file *File, code []byte) (*Src, error) {
	var tree *sitter.Tree
	var err error

	lang := file.Lang()
	parser := createParser(lang)
	defer parser.Close()

	tree, err = parser.ParseCtx(context.Background(), nil, code)
	if err != nil {
		return nil, err
	}

	return &Src{
		code: code,
		file: file,
		lang: lang,
		tree: tree,
	}, nil
}

func readRepoFile(file *File) []byte {
	src, err := os.ReadFile(path.Join(RepoRoot, file.rootPath))
	if err != nil {
		log.Panicf("error reading repo file for %s: %v\n", file.rootPath, err)
	}

	return src
}

func createParser(language *sitter.Language) *sitter.Parser {
	parser := sitter.NewParser()
	parser.SetLanguage(language)
	return parser
}
