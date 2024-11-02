package parse

import (
	sitter "github.com/smacker/go-tree-sitter"
)

type NodeUpdater interface {
	Update(node *sitter.Node, src *Src, repo *Repo) (OutputChunkList, error)
}

type OutputChunkList []any

func NewOutputChunkList(initialCapacity int) OutputChunkList {
	return make(OutputChunkList, 0, initialCapacity)
}

func (self *OutputChunkList) Push(chunks ...any) *OutputChunkList {
	*self = append(*self, chunks...)
	return self
}
