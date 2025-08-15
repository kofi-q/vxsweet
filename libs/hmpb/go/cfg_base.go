package hmpb

import "fmt"

const (
	bubbleLnWidth = 1 * Px
	fontSizeBase  = 12
)

var fontSize = CfgFontSize{
	Base:    fontSizeBase,
	Caption: 9.5,
	H1:      1.4 * fontSizeBase,
	H2:      1.2 * fontSizeBase,
	H3:      1.1 * fontSizeBase,
	H4:      fontSizeBase,
	Pico:    5.5,
	Tiny:    8,
}

var CfgBase = Cfg{
	BubbleAlignRight: false,
	BubbleLnWidth:    bubbleLnWidth,
	BubbleSize: Vec2{
		19*Px - bubbleLnWidth,
		13*Px - bubbleLnWidth,
	},
	CandidateContestInstructions: CandidateContestInstructions,
	OptionSpacing:                5,
	ColCountCandidate:            3,
	ColCountYesNo:                2,
	Color: CfgColor{
		OptionDivider: Color{0xda, 0xda, 0xda},
		Tint:          Color{0xee, 0xee, 0xee},
	},
	FontSize:            fontSize,
	FooterContentHeight: 3 * fontSize.Base,
	FooterIconSize:      2 * fontSizeBase,
	FooterPadding:       Vec2{0.5 * fontSize.Base, 0.25 * fontSize.Base},
	Grid: CfgGrid{
		MarkSize: Vec2{0.1875 * Inch, 0.0625 * Inch},
	},
	IndentSize:                   fontSize.Base * 2,
	InstructionImgWidth:          1.2 * Inch,
	InstructionWriteInWidthRatio: 0.6,
	LineHeight:                   1.2 * fontSize.Base,
	LnHeight: CfgLineHeight{
		Base:    1.2 * fontSize.Base,
		Caption: 1.2 * fontSize.Caption,
		H1:      1.2 * fontSize.H1,
		H2:      1.2 * fontSize.H2,
		H3:      1.2 * fontSize.H3,
		H4:      1.2 * fontSize.H4,
		Pico:    1.2 * fontSize.Pico,
		Tiny:    1.2 * fontSize.Tiny,
	},
	Padding:            Vec2{9, 9},
	PaddingBox:         Vec2{7, 8},
	PaddingOption:      Vec2{7, 7},
	PaddingTableCell:   Vec2{6, 4},
	ParagraphGap:       0.75 * fontSize.Base,
	PrintMargin:        Vec2{5 * Mm, 12},
	QrSize:             0.6 * Inch,
	SealSize:           60,
	WriteInHeight:      31,
	WriteInLabelMargin: 1,
}

func CandidateContestInstructions(
	seatCount uint8,
) (stringKeys []string, err error) {
	switch seatCount {
	case 1:
		stringKeys = []string{"hmpbVoteFor1"}
	case 2:
		stringKeys = []string{"hmpbVoteFor2"}
	case 3:
		stringKeys = []string{"hmpbVoteFor3"}
	case 4:
		stringKeys = []string{"hmpbVoteFor4"}
	case 5:
		stringKeys = []string{"hmpbVoteFor5"}
	case 6:
		stringKeys = []string{"hmpbVoteFor6"}
	case 7:
		stringKeys = []string{"hmpbVoteFor7"}
	case 8:
		stringKeys = []string{"hmpbVoteFor8"}
	case 9:
		stringKeys = []string{"hmpbVoteFor9"}
	case 10:
		stringKeys = []string{"hmpbVoteFor10"}
	case 11:
		stringKeys = []string{"hmpbVoteFor10"}
	default:
		err = fmt.Errorf(
			"unsupported candidate seat count: %d",
			seatCount,
		)
	}

	return
}
