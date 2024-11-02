package parse

import (
	"io/fs"
	"log"
	"os/exec"
	"path"
	"path/filepath"
	"slices"
	"strings"
)

var (
	sourceDirs = [...]string{
		RepoRoot + "/apps",
		RepoRoot + "/libs",
		RepoRoot + "/script",
		RepoRoot + "/tools",
	}

	importableRootFiles = [...]string{
		RepoRoot + "/tsconfig.json",
	}

	supportedExtensions = [...]string{
		".json",
		".ts",
		".tsx",
	}
)

func ListFiles() *Repo {
	repo := NewRepo()
	repoRootPrefixLength := len(RepoRoot) + 1

	visitFile := func(absolutePath string, entry fs.DirEntry, _ error) error {
		if entry.IsDir() {
			return nil
		}

		// Skip files in root dir, except hackily for files that are imported in
		// other source dirs:
		isRootSourceFile := slices.Contains(importableRootFiles[:], absolutePath)
		if path.Dir(absolutePath) == RepoRoot && !isRootSourceFile {
			return nil
		}

		if !InSourceDir(absolutePath) && !isRootSourceFile {
			return filepath.SkipDir
		}

		if !hasSupportedExtension(absolutePath) {
			return nil
		}

		repo.Add(absolutePath[repoRootPrefixLength:])

		return nil
	}

	err := filepath.WalkDir(RepoRoot, visitFile)
	if err != nil {
		log.Fatalf("directory walk failed: %v", err)
	}

	registerFileMoves(repo)

	return repo
}

func hasSupportedExtension(filename string) bool {
	return slices.Contains(supportedExtensions[:], path.Ext(filename))
}

func InSourceDir(absolutePath string) bool {
	return slices.ContainsFunc(sourceDirs[:], func(sourceDir string) bool {
		return strings.HasPrefix(absolutePath, sourceDir)
	})
}

// Extracts file move information from `git status“
//
// Assumes all relevant file moves are git-tracked.
func registerFileMoves(repo *Repo) {
	gitStatus := exec.Command("git", "status", "--porcelain")
	gitStatus.Dir = RepoRoot
	result, err := gitStatus.Output()
	if err != nil {
		log.Fatalf("unable to get git status: %v", err)
	}

	for _, statusLine := range strings.Split(string(result), "\n") {
		if len(statusLine) == 0 || statusLine[0] != 'R' {
			continue
		}

		// ```
		// > git status --porcelain
		// R  old/path/to/file_a.ts -> new/path/to/file_a.ts
		// RM old/path/to/file_b.ts -> new/path/to/file_b.ts
		// ```
		move := strings.Split(statusLine[3:], " -> ")
		from, to := move[0], move[1]
		if toFile := repo.Find(to); toFile != nil {
			repo.RegisterMove(from, toFile)
		}
	}
}
