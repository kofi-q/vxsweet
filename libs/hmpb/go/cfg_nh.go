package hmpb

import "fmt"

var (
	CfgNh = initCfgNh()
)

func initCfgNh() Cfg {
	nh := CfgBase
	nh.BubbleAlignRight = true
	nh.CandidateContestInstructions = CandidateContestInstructionsNh
	nh.ColCountYesNo = 1

	return nh
}

func CandidateContestInstructionsNh(
	seatCount uint8,
) (stringKeys []string, err error) {
	switch seatCount {
	case 1:
		stringKeys = []string{"hmpbVoteFor1"}
	case 2:
		stringKeys = []string{"hmpbVoteFor2", "hmpb2WillBeElected"}
	case 3:
		stringKeys = []string{"hmpbVoteFor3", "hmpb3WillBeElected"}
	case 4:
		stringKeys = []string{"hmpbVoteFor4", "hmpb4WillBeElected"}
	case 5:
		stringKeys = []string{"hmpbVoteFor5", "hmpb5WillBeElected"}
	case 6:
		stringKeys = []string{"hmpbVoteFor6", "hmpb6WillBeElected"}
	case 7:
		stringKeys = []string{"hmpbVoteFor7", "hmpb7WillBeElected"}
	case 8:
		stringKeys = []string{"hmpbVoteFor8", "hmpb8WillBeElected"}
	case 9:
		stringKeys = []string{"hmpbVoteFor9", "hmpb9WillBeElected"}
	case 10:
		stringKeys = []string{"hmpbVoteFor10", "hmpb10WillBeElected"}
	case 11:
		stringKeys = []string{"hmpbVoteFor10", "hmpb10WillBeElected"}
	default:
		err = fmt.Errorf(
			"unsupported candidate seat count: %d",
			seatCount,
		)
	}

	return
}
