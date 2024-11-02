package main

import (
	"fmt"
	"time"

	"github.com/kofi-q/vxsweet/tools/ts-refactor/parse"
)

func main() {
	startTime := time.Now()

	repo := parse.ListFiles()
	srcLoader := &parse.FsSrcLoader{}

	parse.ProcessExports(repo, srcLoader)
	exportsTime := time.Now()
	fmt.Println("✅ [", exportsTime.Sub(startTime), "]", "Processed exports")

	refactorRepo(repo, srcLoader)
	fmt.Println("✅ [", time.Since(exportsTime), "]", "Refactored imports")

	fmt.Println("✅ Done!")
}
