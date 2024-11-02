package parse

import (
	"iter"
	"log"
	"maps"
)

type Repo struct {
	files map[string]*File
	moves map[string]*File
}

func NewRepo() *Repo {
	return &Repo{
		files: map[string]*File{},
		moves: map[string]*File{},
	}
}

func (self *Repo) Add(rootPath string) *File {
	if _, isDupe := self.files[rootPath]; isDupe {
		log.Panicf("duplicate file registration for %s\n", rootPath)
	}

	file := &File{
		exports:  Exports{},
		repo:     self,
		rootPath: rootPath,
	}
	self.files[rootPath] = file

	return file
}

func (self Repo) Iter() iter.Seq[*File] {
	return maps.Values(self.files)
}

func (self *Repo) RegisterMove(
	oldRootPath string,
	file *File,
) *Repo {
	if file.repo != self {
		log.Panicf(
			"attempted file move registration for unregistered file: %s\n",
			file,
		)
	}

	if _, isDupe := self.moves[oldRootPath]; isDupe {
		log.Panicf(
			"duplicate old path registration for file move %s -> %s\n",
			oldRootPath,
			file,
		)
	}

	self.moves[oldRootPath] = file
	file.rootPathPrevious = oldRootPath

	return self
}

func (self Repo) Find(rootPath string) *File {
	if file, ok := self.files[rootPath]; ok {
		return file
	}

	if movedFile, wasMoved := self.moves[rootPath]; wasMoved {
		return movedFile
	}

	return nil
}
