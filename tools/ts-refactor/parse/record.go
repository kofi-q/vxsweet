package parse

import (
	"fmt"
	"log"
	"path"
	"path/filepath"
	"slices"
	"strings"
)

var (
	configFilePathSuffixes = [...]string{
		".config.js",
		".config.mjs",
		".config.ts",
		"tools/eslint/config.ts",
		"tools/jest/config.ts",
	}
)

type File struct {
	exports          Exports
	repo             *Repo
	reexportedFiles  []*File
	rootPath         string
	rootPathPrevious string
}

func NewFile(rootPath string) *File {
	return &File{
		exports:         Exports{},
		reexportedFiles: []*File{},
		rootPath:        rootPath,
	}
}

func (self *File) FindIndex() *File {
	if strings.HasSuffix(self.rootPath, "/index.ts") ||
		strings.HasSuffix(self.rootPath, "/index.tsx") {
		return nil
	}

	currentDir := path.Dir(self.rootPath)
	maxDepth := 5
	for range maxDepth {
		if currentDir == "." {
			break
		}

		indexFilePath := currentDir + "/index.ts"
		currentDir = path.Dir(currentDir)

		indexFile := self.repo.Find(indexFilePath)
		if indexFile == nil {
			continue
		}

		if indexFile.DoesReexportFile(self) {
			return indexFile
		}
	}

	return nil
}

func (self *File) DoesReexportFile(file *File) bool {
	return slices.Contains(self.reexportedFiles, file)
}

func (self *File) RegisterExports(exports ...*Export) *File {
	for _, export := range exports {
		export.Location = self

		if export.From != nil {
			self.reexportedFiles = append(self.reexportedFiles, export.From)
		}

		if export.Is(EXPORT_WILDCARD) {
			continue
		}

		existingExport := self.exports.Find(export.Name)
		if existingExport != nil && existingExport.Flags == export.Flags {
			log.Fatalf(
				"attempted to register duplicate export %s for %s\n",
				export.Name,
				self.rootPath,
			)
		}
	}

	self.exports = append(self.exports, exports...)
	return self
}

func (self File) AbsolutePath() string {
	return path.Join(RepoRoot, self.rootPath)
}

func (self *File) ImportPath(importingFile *File) string {
	var canonicalPath string
	if importingFile.CanUseRelativeImport(self) {
		relativePath, err := filepath.Rel(
			path.Dir(importingFile.AbsolutePath()),
			self.AbsolutePath(),
		)

		if err != nil {
			log.Fatalf(
				"unable to construct relative import path from %s to %s",
				importingFile.rootPath,
				self.rootPath,
			)
		}

		canonicalPath = relativePath
		if !strings.HasPrefix(canonicalPath, ".") {
			canonicalPath = "./" + canonicalPath
		}
	} else {
		canonicalPath = "@vx/" + self.rootPath
	}

	if strings.HasSuffix(canonicalPath, ".json") {
		return canonicalPath
	}

	withoutExtension := strings.TrimSuffix(
		canonicalPath,
		path.Ext(canonicalPath),
	)
	// Trim optional '.d' infix for TS typing files:
	withoutExtension = strings.TrimSuffix(withoutExtension, ".d")

	// Trim unnecessary '/index' path segment:
	withoutIndex := strings.TrimSuffix(withoutExtension, "/index")

	return withoutIndex
}

func (self File) CanUseRelativeImport(target *File) bool {
	// Special case for config files, which may or may not be loaded by a tool
	// that can be configured to use tsconfig paths.
	for _, suffix := range configFilePathSuffixes {
		if strings.HasSuffix(self.rootPath, suffix) {
			return true
		}
	}

	selfPathSegments := strings.Split(self.rootPath, "/")
	targetPathSegments := strings.Split(target.rootPath, "/")

	// TODO: make this check a little more robust
	return selfPathSegments[0] == targetPathSegments[0] &&
		selfPathSegments[1] == targetPathSegments[1]
}

func (self File) String() string {
	return self.rootPath
}

func (self File) ResolveImport(
	importPath string,
	repo *Repo,
) (*File, error) {
	if !IsInternalImport(importPath) {
		return nil, fmt.Errorf(
			"attempted to resolve external import: %s",
			importPath,
		)
	}

	resolvedFile := resolveImport(self.rootPath, importPath, repo)
	if resolvedFile != nil {
		return resolvedFile, nil
	}

	if len(self.rootPathPrevious) > 0 {
		resolvedFile = resolveImport(self.rootPathPrevious, importPath, repo)
		if resolvedFile != nil {
			return resolvedFile, nil
		}
	}

	return nil, fmt.Errorf(
		"unable to resolve import %s from %s",
		importPath,
		self.rootPath,
	)
}

func (self *File) FindNamedExport(name string) *Export {
	for _, export := range self.exports {
		if export.From == nil {
			if export.Name != name {
				continue
			}

			return export
		}

		// Alias or namespace re-export - leave intact for now:
		if export.Name == name &&
			(export.Is(EXPORT_NAMESPACE) || export.Is(EXPORT_ALIAS)) {
			return export
		}

		// Named re-export - assume re-exported file contains canonical export:
		if export.Name == name {
			return export.From.FindNamedExport(name)
		}

		// Wildcard re-export - search re-exported file:
		if export.Is(EXPORT_WILDCARD) {
			matchedChild := export.From.FindNamedExport(name)
			if matchedChild != nil {
				return matchedChild
			}
		}
	}

	return nil
}

func (self *File) FindDefaultExport() *Export {
	for _, export := range self.exports {
		if export.Is(EXPORT_DEFAULT) {
			return export
		}
	}

	return nil
}

func (self *File) TransitiveExports() []*Export {
	allExports := []*Export{}

	for _, export := range self.exports {
		if export.From == nil {
			allExports = append(allExports, export)
			continue
		}

		if export.Is(EXPORT_NAMED) {
			allExports = append(
				allExports,
				export.From.FindNamedExport(export.Name),
			)
			continue
		}

		if export.Is(EXPORT_WILDCARD) {
			allExports = append(allExports, export.From.TransitiveExports()...)
			continue
		}

		// Alias or namespace re-export - assume it's been moved to a new index:
		if len(export.Name) > 0 {
			indexFile := export.From.FindIndex()
			if indexFile != nil && indexFile != self {
				allExports = append(
					allExports,
					indexFile.FindNamedExport(export.Name),
				)
			} else {
				allExports = append(allExports, export)
			}

			continue
		}

		log.Panicf("unhandled export type: %#v", export)
	}

	return allExports
}
