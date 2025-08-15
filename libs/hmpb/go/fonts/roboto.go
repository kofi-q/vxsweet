package fonts

import _ "embed"

var (
	//go:embed Roboto-Regular.ttf
	FontRoboto []byte

	//go:embed Roboto-Bold.ttf
	FontRobotoBold []byte

	//go:embed Roboto-Italic.ttf
	FontRobotoItalic []byte
)
