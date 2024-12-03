package main

import (
	"archive/zip"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
)

var (
	pathRepoRoot = flag.String("rootDir", "", "Relate path to the repo root.")
	pathOutFile  = flag.String("outFile", "", "Relative path to the output file.")

	sourceDirs = [...]string{
		"apps",
		"libs",
	}

	ignoredDirs = [...]string{
		"docs",
		"libs/fixtures",
		"script",
		"tools",
	}
)

func main() {
	flag.Parse()
	if *pathRepoRoot == "" || *pathOutFile == "" {
		flag.Usage()
		os.Exit(1)
	}

	pwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintln(os.Stderr, "[ERROR] Unable to get working directory:", err)
		os.Exit(1)
	}

	repoRootAbs := path.Join(pwd, *pathRepoRoot)
	pathOutFileAbs := path.Join(pwd, *pathOutFile)

	err = writeArchive(repoRootAbs, pathOutFileAbs)
	if err != nil {
		log.Fatalln("[ERROR] Unable to create archive file:", err)
	}

	os.Exit(0)
}

func writeArchive(repoRootAbs string, pathOutFileAbs string) error {
	outArchive := newArchive(repoRootAbs, pathOutFileAbs)
	defer outArchive.close()

	err := filepath.WalkDir(
		repoRootAbs,
		func(pathToFile string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}

			if pathToFile == repoRootAbs || pathToFile == outArchive.name() {
				return nil
			}

			// [HACK] Filter out locales we don't need from the Playwright browser
			// package to keep the archive size manageable.
			dirname := path.Dir(pathToFile)
			if strings.HasSuffix(dirname, "chrome-linux/locales") {
				if !strings.HasPrefix(entry.Name(), "en-US") {
					return nil
				}
			}

			pathToFileRel := pathToFile[len(repoRootAbs)+1:]
			if slices.Contains(ignoredDirs[:], pathToFileRel) {
				return filepath.SkipDir
			}

			info, err := entry.Info()
			if err != nil {
				return err
			}

			realPath := pathToFile

			isSymLink := info.Mode()&os.ModeSymlink == os.ModeSymlink
			if isSymLink {
				realPath, err = os.Readlink(pathToFile)
				if err != nil {
					return fmt.Errorf("Unable to read node_modules symlink: %w\n", err)
				}

				// Symlinks in `node_modules` that point to other `node_modules`
				// packages will resolve to relative paths. These are preserved as
				// symlinks in the archive to preserve the node_modules structure and
				// avoid duplication.
				if !path.IsAbs(realPath) {
					return outArchive.writeSymLink(info, pathToFile, realPath)
				}
			}

			if entry.IsDir() {
				return nil
			}

			return outArchive.writeCopy(info, pathToFile, realPath)
		},
	)

	if err != nil {
		return fmt.Errorf(`[ERROR] Unable to archive: %w`, err)
	}

	return nil
}

type archive struct {
	file           *os.File
	pathOutFileAbs string
	repoRootAbs    string
	writer         *zip.Writer
}

func newArchive(repoRootAbs string, pathOutFileAbs string) *archive {
	file, err := os.Create(pathOutFileAbs)
	if err != nil {
		log.Fatalln("[ERROR] Unable to open output file for writing:", err)
	}

	return &archive{
		file:           file,
		pathOutFileAbs: pathOutFileAbs,
		repoRootAbs:    repoRootAbs,
		writer:         zip.NewWriter(file),
	}
}

func (self *archive) name() string {
	return self.file.Name()
}

func (self *archive) close() {
	mustSucceed := func(err error) {
		if err != nil {
			log.Fatalln("[ERROR] Unable to write archive:", err)
		}
	}
	mustSucceed(self.writer.Flush())
	mustSucceed(self.writer.Close())
	mustSucceed(self.file.Close())
}

func (self *archive) writeCopy(
	info os.FileInfo,
	pathToFile string,
	realPath string,
) error {
	var err error

	isSymLink := info.Mode()&os.ModeSymlink == os.ModeSymlink
	if isSymLink {
		info, err = os.Stat(realPath)
		if err != nil {
			return fmt.Errorf("Unable to resolve node_modules symlink: %w\n", err)
		}
	}

	zipHeader, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}

	zipHeader.Name = pathToFile[len(self.repoRootAbs)+1:]
	zipHeader.Method = zip.Deflate
	writerEntry, err := self.writer.CreateHeader(zipHeader)
	if err != nil {
		return err
	}

	readerEntry, err := os.Open(realPath)
	if err != nil {
		return err
	}
	defer readerEntry.Close()

	_, err = io.Copy(writerEntry, readerEntry)
	if err != nil {
		return fmt.Errorf("Unable to copy file to archive: %w\n", err)
	}

	return nil
}

func (self *archive) writeSymLink(
	info os.FileInfo,
	pathToFile string,
	realPath string,
) error {
	zipHeader, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}

	zipHeader.Name = pathToFile[len(self.repoRootAbs)+1:]
	zipHeader.Method = zip.Store
	writerEntry, err := self.writer.CreateHeader(zipHeader)
	if err != nil {
		return err
	}

	_, err = writerEntry.Write([]byte(realPath))
	if err != nil {
		return fmt.Errorf("Unable to write node_modules symlink: %w\n", err)
	}

	return nil
}
