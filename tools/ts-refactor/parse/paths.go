package parse

import (
	"log"
	"os"
	"path"
	"strings"

	sitter "github.com/smacker/go-tree-sitter"
)

var (
	RepoRoot = os.Getenv("BUILD_WORKSPACE_DIRECTORY")
)

func (self File) Lang() *sitter.Language {
	var lang *sitter.Language

	extension := path.Ext(self.rootPath)
	switch extension {
	case ".ts":
		lang = LangTs
	case ".tsx":
		lang = LangTsx
	case "":
		log.Fatalf("missing file extension for %s\n", self.rootPath)
	default:
		log.Fatalf("invalid source file type: %s\n", self.rootPath)
	}

	return lang
}

func IsInternalImport(importPath string) bool {
	return strings.HasPrefix(importPath, "@vx/") ||
		strings.HasPrefix(importPath, ".")
}

func resolveImport(
	fromRepoFilePath string,
	toImportPath string,
	repo *Repo,
) *File {
	var toRepoFilePath string
	if toImportPath[0] == '@' {
		toRepoFilePath = toImportPath[4:] // @vx/*
	} else {
		toRepoFilePath = path.Clean(path.Join(
			RepoRoot,
			path.Dir(fromRepoFilePath),
			toImportPath,
		))[len(RepoRoot):]

		// Should use len(RepoRoot)+1 above, but BUILD_WORKSPACE_DIRECTORY (and
		// hence RepoRoot) is empty for tests.
		toRepoFilePath = strings.TrimPrefix(toRepoFilePath, "/")
	}

	potentialPaths := []string{}
	if strings.HasSuffix(toRepoFilePath, ".json") {
		potentialPaths = append(potentialPaths, toRepoFilePath)
	}

	potentialPaths = append(potentialPaths,
		toRepoFilePath+".ts",
		toRepoFilePath+".tsx",
		toRepoFilePath+".d.ts",
		path.Join(toRepoFilePath, "index.ts"),
		path.Join(toRepoFilePath, "index.tsx"),
	)

	for _, potentialPath := range potentialPaths {
		if file := repo.Find(potentialPath); file != nil {
			return file
		}
	}

	return nil
}
