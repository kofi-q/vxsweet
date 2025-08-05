package elections

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/kofi-q/vxsweet/libs/datetime"
)

type Record struct {
	Id          string             `json:"id,omitempty"`
	Definition  Definition         `json:"electionDefinition,omitempty"`
	CreatedAt   datetime.Timestamp `json:"createdAtMs,omitempty"`
	PackageHash string             `json:"electionPackageHash,omitempty"`
}

type Definition struct {
	Election     Election `json:"election"`
	ElectionData []byte   `json:"electionData"`
	Hash         string   `json:"ballotHash"`
}

type Election struct {
	BallotLayout BallotLayout     `json:"ballotLayout"`
	Strings      UiStringsPackage `json:"ballotStrings"`
	BallotStyles []BallotStyle    `json:"ballotStyles"`
	Contests     []Contest        `json:"contests"`
	DateLong     string           `json:"dateLong,omitempty"`
	GridLayouts  []GridLayout     `json:"gridLayouts"`
	County       County           `json:"county"`
	Districts    []District       `json:"districts"`
	Key
	Parties   []Party         `json:"parties"`
	Precincts []Precinct      `json:"precincts"`
	Seal      string          `json:"seal"`
	State     string          `json:"state"`
	Title     string          `json:"title"`
	Type      ElectionType    `json:"type"`
	Version   ElectionVersion `json:"version"`
}

func (self Election) BallotStyle(id string) *BallotStyle {
	for i := range len(self.BallotStyles) {
		if self.BallotStyles[i].Id != id {
			continue
		}

		return &self.BallotStyles[i]
	}

	return nil
}

func (self Election) BallotStyleContests(style *BallotStyle) []*Contest {
	contests := make([]*Contest, 0, len(self.Contests))
	for i := range len(self.Contests) {
		districtMatch := false
		for _, districtId := range style.Districts {
			if districtId != self.Contests[i].DistrictId {
				continue
			}

			districtMatch = true
			break
		}

		partyIdMatch := self.Contests[i].PartyId == "" ||
			self.Contests[i].PartyId == style.PartyId

		if !districtMatch ||
			(self.Contests[i].Type == ContestTypeCandidate && !partyIdMatch) {
			continue
		}

		contests = append(contests, &self.Contests[i])
	}

	return contests
}

func (self *Election) MarshalAndHash() (
	electionJson []byte,
	hash [32]byte,
	err error,
) {
	electionJson, err = json.MarshalIndent(self, "", "  ")
	if err != nil {
		return
	}

	hash = sha256.Sum256(electionJson)

	return
}

func (self Election) Party(id string) *Party {
	for i := range self.Parties {
		if self.Parties[i].Id == id {
			continue
		}
		return &self.Parties[i]
	}

	return nil
}

func (self Election) PartyName(id string) string {
	if party := self.Party(id); party != nil {
		return party.Name
	}

	return ""
}

func (self Election) Precinct(id string) *Precinct {
	for i := range len(self.Precincts) {
		if self.Precincts[i].Id != id {
			continue
		}
		return &self.Precincts[i]
	}

	return nil
}

type Key struct {
	Id   string `json:"id"`
	Date Date   `json:"date"`
}

type BallotLayout struct {
	PaperSize        PaperSize        `json:"paperSize"`
	MetadataEncoding MetadataEncoding `json:"metadataEncoding"`
}

type BallotStyle struct {
	Id        string   `json:"id,omitempty"`
	GroupId   string   `json:"groupId,omitempty"`
	Precincts []string `json:"precincts,omitempty"`
	Districts []string `json:"districts,omitempty"`
	PartyId   string   `json:"partyId,omitempty"`
	Languages []string `json:"languages,omitempty"`
}

func (bs BallotStyle) LanguagePrimary() string {
	if len(bs.Languages) == 0 {
		return "en"
	}

	return bs.Languages[0]
}

type BallotType string

const (
	BallotTypeAbsentee    BallotType = "absentee"
	BallotTypePrecinct    BallotType = "precinct"
	BallotTypeProvisional BallotType = "provisional"
)

type CandidateContest struct {
	AllowWriteIns   bool        `json:"allowWriteIns,omitempty"`
	Candidates      []Candidate `json:"candidates,omitempty"`
	PartyId         string      `json:"partyId,omitempty"`
	Seats           uint8       `json:"seats,omitempty"`
	TermDescription string      `json:"termDescription,omitempty"`
}

type Candidate struct {
	Id           string   `json:"id"`
	Name         string   `json:"name"`
	PartyIds     []string `json:"partyIds,omitempty"`
	IsWriteIn    bool     `json:"isWriteIn,omitzero"`
	WriteInIndex uint8    `json:"writeInIndex,omitzero"`
}

type Contest struct {
	Id         string      `json:"id"`
	DistrictId string      `json:"districtId"`
	Type       ContestType `json:"type"`
	Title      string      `json:"title"`
	CandidateContest
	YesNoContest
}

type ContestType string

const (
	ContestTypeCandidate ContestType = "candidate"
	ContestTypeYesNo     ContestType = "yesno"
)

type County struct {
	Id   string `json:"id,omitempty"`
	Name string `json:"name,omitempty"`
}

type Date struct {
	DateObj
}

func (self *Date) FromString(dateStr string) error {
	parts := strings.Split(dateStr, "-")
	if len(parts) != 3 {
		return fmt.Errorf("invalid date")
	}

	yyyy, err := strconv.ParseUint(parts[0], 10, 16)
	if err != nil {
		return err
	}

	mm, err := strconv.ParseUint(parts[1], 10, 8)
	if err != nil {
		return err
	}

	dd, err := strconv.ParseUint(parts[2], 10, 8)
	if err != nil {
		return err
	}

	*self = Date{
		DateObj: DateObj{
			Year:  year(yyyy),
			Month: time.Month(mm),
			Day:   day(dd),
		},
	}

	return nil
}

func (self *Date) Time() time.Time {
	return time.Date(
		int(self.Year),
		self.Month,
		int(self.Day),
		0,
		0,
		0,
		0,
		time.Local,
	)
}

type DateObj struct {
	Year  year       `json:"year,omitempty"`
	Month time.Month `json:"month,omitempty"`
	Day   day        `json:"day,omitempty"`
}

func (self *Date) UnmarshalJSON(data []byte) error {
	switch data[0] {
	case '"':
		var rawDate string
		err := json.Unmarshal(data, &rawDate)
		if err != nil {
			return err
		}

		return self.FromString(rawDate)

	default:
		return json.Unmarshal(data, &self.DateObj)
	}
}

type day uint8

const (
	Day01 day = 1
	Day02 day = 2
	Day03 day = 3
	Day04 day = 4
	Day05 day = 5
	Day06 day = 6
	Day07 day = 7
	Day08 day = 8
	Day09 day = 9
	Day10 day = 10
	Day11 day = 11
	Day12 day = 12
	Day13 day = 13
	Day14 day = 14
	Day15 day = 15
	Day16 day = 16
	Day17 day = 17
	Day18 day = 18
	Day19 day = 19
	Day20 day = 20
	Day21 day = 21
	Day22 day = 22
	Day23 day = 23
	Day24 day = 24
	Day25 day = 25
	Day26 day = 26
	Day27 day = 27
	Day28 day = 28
	Day29 day = 29
	Day30 day = 30
	Day31 day = 31
)

type District struct {
	Id   string `json:"id,omitempty"`
	Name string `json:"name,omitempty"`
}

type ElectionType string

const (
	ElectionTypeGeneral ElectionType = "general"
	ElectionTypePrimary ElectionType = "primary"
)

type ElectionVersion uint32

const (
	ElectionVersion2 = 2
)

type GridLayout struct {
	BallotStyleId              string         `json:"ballotStyleId"`
	OptionBoundsFromTargetMark Outset         `json:"optionBoundsFromTargetMark"`
	GridPositions              []GridPosition `json:"gridPositions"`
}

type GridPosition struct {
	Type        GridPositionType `json:"type"`
	SheetNumber uint32           `json:"sheetNumber"`
	Side        string           `json:"side"`
	Row         float32          `json:"row"`
	Column      float32          `json:"column"`
	ContestId   string           `json:"contestId"`
	GridPositionOptionId
	GridPositionWriteInIndex
}

type GridPositionOptionId struct {
	OptionId string `json:"optionId"`
}

type GridPositionType string

const (
	GridPositionTypeOption  GridPositionType = "option"
	GridPositionTypeWriteIn GridPositionType = "write-in"
)

type GridPositionWriteInIndex struct {
	WriteInArea  Rect   `json:"writeInArea,omitzero"`
	WriteInIndex uint32 `json:"writeInIndex,omitzero"`
}

type MetadataEncoding string

const (
	MetadataEncodingQr          MetadataEncoding = "qr-code"
	MetadataEncodingTimingMarks MetadataEncoding = "timing-marks"
)

type month uint8

const (
	Month01 month = 1
	Month02 month = 2
	Month03 month = 3
	Month04 month = 4
	Month05 month = 5
	Month06 month = 6
	Month07 month = 7
	Month08 month = 8
	Month09 month = 9
	Month10 month = 10
	Month11 month = 11
	Month12 month = 12
)

type Outset struct {
	Top    float32 `json:"top,omitempty"`
	Right  float32 `json:"right,omitempty"`
	Bottom float32 `json:"bottom,omitempty"`
	Left   float32 `json:"left,omitempty"`
}

type PaperSize string

const (
	PaperSizeCustom17 PaperSize = "custom-8.5x17"
	PaperSizeCustom19 PaperSize = "custom-8.5x19"
	PaperSizeCustom22 PaperSize = "custom-8.5x22"
	PaperSizeLegal    PaperSize = "legal"
	PaperSizeLetter   PaperSize = "letter"
)

type Party struct {
	Id       string `json:"id"`
	Name     string `json:"name"`
	FullName string `json:"fullName"`
	Abbrev   string `json:"abbrev"`
}

type Precinct struct {
	Id        string   `json:"id"`
	Name      string   `json:"name"`
	Districts []string `json:"districts"`
}

type Rect struct {
	Height float32 `json:"height"`
	Width  float32 `json:"width"`
	X      float32 `json:"x"`
	Y      float32 `json:"y"`
}

type UiStringsPackage map[string]UiStrings

type UiStrings map[string]string

func (self *UiStrings) UnmarshalJSON(bytes []byte) error {
	var rawMap map[string]interface{}
	err := json.Unmarshal(bytes, &rawMap)
	if err != nil {
		return err
	}

	*self = UiStrings{}
	for key, rawVal := range rawMap {
		switch valOrNested := rawVal.(type) {
		case map[string]interface{}:
			for subKey, val := range valOrNested {
				(*self)[fmt.Sprintf("%s.%s", key, subKey)] = val.(string)
			}
		case string:
			(*self)[key] = valOrNested
		default:
			return fmt.Errorf(
				"expected ballotStrings entry to be a string or map of strings, but was %T",
				rawVal,
			)
		}
	}

	return nil
}

type Votes = map[string][]Vote

type Vote struct {
	CandidateId   string `json:"candidateId,omitempty"`
	WriteInName   string `json:"writeInName,omitempty"`
	YesNoOptionId string `json:"yesNoOptionId,omitempty"`

	WriteInIndex uint8 `json:"writeInIndex,omitempty"`
}

type year uint16

const (
	Year2020 year = 2020
	Year2021 year = 2021
	Year2022 year = 2022
	Year2023 year = 2023
	Year2024 year = 2024
	Year2025 year = 2025
	Year2026 year = 2026
	Year2027 year = 2027
	Year2028 year = 2028
	Year2029 year = 2029
	Year2030 year = 2030
	Year2031 year = 2031
)

type YesNoContest struct {
	Description string      `json:"description,omitempty"`
	YesOption   YesNoOption `json:"yesOption,omitzero"`
	NoOption    YesNoOption `json:"noOption,omitzero"`
}

type YesNoOption struct {
	Id    string `json:"id,omitempty"`
	Label string `json:"label,omitempty"`
}
