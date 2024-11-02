package main

import (
	"bytes"
	"fmt"
	"os"
	"path"
	"runtime"
	"slices"
	"sync"

	"github.com/kofi-q/vxsweet/tools/ts-refactor/ast"
	"github.com/kofi-q/vxsweet/tools/ts-refactor/parse"
	sitter "github.com/smacker/go-tree-sitter"
)

const (
	maxWorkers = 10
)

var (
	srcFileExtensions = [...]string{".ts", ".tsx"}
)

func refactorRepo(
	repo *parse.Repo,
	srcLoader parse.SrcLoader,
) {
	repoFileChannel := make(chan *parse.File)

	var wg sync.WaitGroup
	for i := range min(runtime.NumCPU()-1, maxWorkers) {
		wg.Add(1)

		go func() {
			defer wg.Done()

			for file := range repoFileChannel {
				src, err := srcLoader.LoadSrc(file)
				if err != nil {
					fmt.Printf(
						"❌ [ refactor worker %d ] %s: %v\n",
						i,
						file,
						err,
					)
				}
				defer src.Dispose()

				newContent, err := newRefactorTask(src, repo).run()
				if err != nil {
					fmt.Printf(
						"❌ [ refactor worker %d ] %s: %v\n",
						i,
						file,
						err,
					)
					continue
				}

				if bytes.Equal(src.Code(), []byte(newContent)) {
					continue
				}
				os.WriteFile(file.AbsolutePath(), []byte(newContent), 0644)
			}
		}()

	}

	go func() {
		for file := range repo.Iter() {
			if !slices.Contains(
				srcFileExtensions[:],
				path.Ext(file.AbsolutePath()),
			) {
				continue
			}

			repoFileChannel <- file
		}

		close(repoFileChannel)
	}()

	wg.Wait()
}

type refactorTask struct {
	exportUpdater   *parse.ExportUpdater
	importUpdater   *parse.ImportUpdater
	jestMockUpdater *parse.JestMockUpdater
	repo            *parse.Repo
	src             *parse.Src
}

func newRefactorTask(src *parse.Src, repo *parse.Repo) *refactorTask {
	return &refactorTask{
		exportUpdater:   parse.NewExportUpdater(src, repo),
		importUpdater:   parse.NewImportUpdater(src, repo),
		jestMockUpdater: parse.NewJestMockUpdater(src, repo),
		repo:            repo,
		src:             src,
	}
}

func (self *refactorTask) run() (string, error) {
	root := self.src.RootNode()
	nodeCount := int(root.NamedChildCount())

	outputChunks := parse.NewOutputChunkList(nodeCount)
	reader := self.src.NewReader()

	for i := range nodeCount {
		node := root.NamedChild(i)

		var newChunks parse.OutputChunkList
		var err error

		switch node.Type() {
		case ast.NODE_IMPORT_STATEMENT:
			newChunks, err = self.importUpdater.Update(node)

		case ast.NODE_EXPORT_STATEMENT:
			newChunks, err = self.exportUpdater.Update(node)

		case ast.NODE_EXPRESSION_STATEMENT:
			newChunks, err = self.processExpressionStatement(node)

		default:
			continue
		}

		if err != nil {
			return "", err
		}

		unprocessedFiledChunk, err := reader.ReadTo(int(node.StartByte()))
		if err != nil {
			return "", err
		}

		outputChunks.Push(unprocessedFiledChunk)
		outputChunks.Push(newChunks...)

		if err := reader.Seek(int(node.EndByte())); err != nil {
			return "", err
		}

		// Newlines aren't included in the tree-sitter node, so skip over trailing
		// ones to simplify updater logic a bit:
		reader.MaybeConsumeTrailingNewline()
	}

	finalChunk, err := reader.ReadToEnd()
	if err != nil {
		return "", nil
	}

	outputChunks.Push(finalChunk)

	return fmt.Sprint(outputChunks...), nil
}

func (self *refactorTask) processExpressionStatement(
	node *sitter.Node,
) (parse.OutputChunkList, error) {
	expression := node.NamedChild(0)
	if expression.Type() != ast.NODE_CALL_EXPRESSION {
		return parse.OutputChunkList{node.Content(self.src.Code()), "\n"}, nil
	}

	functionName := expression.ChildByFieldName("function")

	switch functionName.Content(self.src.Code()) {
	case "jest.mock":
		return self.jestMockUpdater.Update(node)
	default:
		return parse.OutputChunkList{node.Content(self.src.Code()), "\n"}, nil
	}
}
