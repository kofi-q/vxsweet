package hmpb

type Cfg struct {
	Grid     CfgGrid
	FontSize CfgFontSize
	Color    CfgColor
	LnHeight CfgLineHeight

	BubbleSize       Vec2
	ContestSpacing   Vec2
	FooterPadding    Vec2
	Margins          Vec2
	Padding          Vec2
	PaddingBox       Vec2
	PaddingOption    Vec2
	PaddingTableCell Vec2
	PrintMargin      Vec2

	BubbleLnWidth                float32
	CandidateContestInstructions func(seatCount uint8) (
		stringKeys []string,
		err error,
	)
	ContestOptionOffsetX         float32
	FooterContentHeight          float32
	FooterIconSize               float32
	IndentSize                   float32
	InstructionImgWidth          float32
	InstructionWriteInWidthRatio float32
	LineHeight                   float32
	OptionSpacing                float32
	ParagraphGap                 float32
	QrSize                       float32
	SealSize                     float32
	WriteInHeight                float32
	WriteInLabelMargin           float32

	BubbleAlignRight  bool
	ColCountCandidate uint8
	ColCountYesNo     uint8
	Compact           bool
	NoMetadata        bool
}

type CfgColor struct {
	Fg            Color
	OptionDivider Color
	Tint          Color
}

type Color [3]uint8

func (c Color) Rgb() (uint8, uint8, uint8) {
	return c[0], c[1], c[2]
}

type CfgFontSize struct {
	Base    float32
	Caption float32
	H1      float32
	H2      float32
	H3      float32
	H4      float32
	Pico    float32
	Tiny    float32
}

type CfgLineHeight struct {
	Base    float32
	Caption float32
	H1      float32
	H2      float32
	H3      float32
	H4      float32
	Pico    float32
	Tiny    float32
}

type CfgGrid struct {
	MarkSize Vec2

	X      float32
	XScale float32
	Y      float32
	YScale float32
}
