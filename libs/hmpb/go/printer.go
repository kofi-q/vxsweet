package hmpb

import (
	"bytes"
	"cmp"
	_ "embed"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/kofi-q/scribe-go"
	"github.com/kofi-q/vxsweet/libs/elections"
	"github.com/kofi-q/vxsweet/libs/hmpb/go/fonts"
	goqr "github.com/piglig/go-qr"
	"golang.org/x/text/language"
	"golang.org/x/text/language/display"
)

const (
	logPerf = false
)

var (
	//go:embed mark-bubble.png
	imgMarkBubble []byte

	//go:embed write-in.png
	imgWriteIn []byte
)

const (
	Pt = 1

	Inch = 72.0 * Pt
	Mm   = 2.85 * Pt
	Px   = 72.0 / 96.0 * Pt

	FontSizeDefault = 12
	BorderS         = 0.1 * FontSizeDefault
	BorderM         = 0.15 * FontSizeDefault
	PaddingS        = 0.25 * FontSizeDefault
	PaddingM        = 0.5 * FontSizeDefault

	DpiImg   = 300
	QrSizeIn = 1

	BoxBorderWidth     = 1 * Px
	BoxBorderWidthHalf = 0.5 * BoxBorderWidth

	BoxBorderTopWidth     = 3 * Px
	BoxBorderTopWidthHalf = 0.5 * BoxBorderTopWidth
)

const (
	imgNameMarkBubble = "mark-bubble"
	imgNameWriteIn    = "write-in"
)

var (
	ErrBallotStyleInvalid = errors.New("ballot style not found for given ID")
)

var (
	FontIdRoboto       scribe.FontId
	FontIdRobotoBold   scribe.FontId
	FontIdRobotoItalic scribe.FontId
	FontIdNotoSc       scribe.FontId
	FontIdNotoScBold   scribe.FontId

	template = scribe.CreateTpl(
		scribe.PointType{X: 0, Y: 0},
		scribe.PageSizeLegal,
		scribe.OrientationPortrait,
		scribe.UnitPoint,
		"",
		func(tpl *scribe.Tpl) {
			tpl.SetCatalogSort(true)

			var err error
			FontIdRoboto, err = tpl.AddUTF8FontFromBytes(
				"roboto",
				scribe.FontStyleNone,
				fonts.FontRoboto,
			)
			if err != nil {
				log.Panicf("unable to add template font: %v", err)
			}
			FontIdRobotoBold, err = tpl.AddUTF8FontFromBytes(
				"roboto",
				scribe.FontStyleB,
				fonts.FontRobotoBold,
			)
			if err != nil {
				log.Panicf("unable to add template font: %v", err)
			}
			FontIdRobotoItalic, err = tpl.AddUTF8FontFromBytes(
				"roboto",
				scribe.FontStyleI,
				fonts.FontRobotoItalic,
			)
			if err != nil {
				log.Panicf("unable to add template font: %v", err)
			}

			FontIdNotoSc, err = tpl.AddUTF8FontFromBytes(
				"notosc",
				scribe.FontStyleNone,
				fonts.FontNotoSansSc,
			)
			if err != nil {
				log.Panicf("unable to add template font: %v", err)
			}
			FontIdNotoScBold, err = tpl.AddUTF8FontFromBytes(
				"notosc",
				scribe.FontStyleB,
				fonts.FontNotoSansScBold,
			)
			if err != nil {
				log.Panicf("unable to add template font: %v", err)
			}

			img := tpl.RegisterImageOptionsReader(
				imgNameMarkBubble,
				scribe.ImageOptions{
					ImageType: "png",
					ReadDpi:   true,
				},
				bytes.NewBuffer(imgMarkBubble),
			)
			if err := tpl.Error(); err != nil {
				panic(err)
			}
			img.SetDpi(300)

			img = tpl.RegisterImageOptionsReader(
				imgNameWriteIn,
				scribe.ImageOptions{
					ImageType: "png",
					ReadDpi:   true,
				},
				bytes.NewBuffer(imgWriteIn),
			)
			if err := tpl.Error(); err != nil {
				panic(err)
			}
			img.SetDpi(300)
		},
	)
)

type PrintParams struct {
	PrecinctId string
	StyleId    string
	Type       elections.BallotType

	NoCompress bool
	Official   bool
}

type Printer interface {
	BallotAllBubble(
		io.Writer,
		*Cfg,
		elections.PaperSize,
		AllBubbleBallotMode,
	) (*elections.Election, error)

	Ballot(
		*elections.Election,
		PrintParams,
		*Cfg,
	) (*Renderer, error)
}

type PrinterHmpb struct {
}

func NewPrinterHmpb() PrinterHmpb {
	return PrinterHmpb{}
}

func (p *PrinterHmpb) Ballot(
	election *elections.Election,
	params PrintParams,
	cfg *Cfg,
) (*Renderer, error) {
	r := Renderer{
		cfg:      cfg,
		election: election,
		params:   params,
		printer:  p,
	}

	err := r.render()
	if err != nil {
		return nil, err
	}

	return &r, err
}

type timings struct {
	start      time.Time
	pdfInit    time.Time
	header     time.Time
	candidates time.Time
	measures   time.Time
	footers    time.Time
	output     time.Time
}

func (self timings) String() string {
	return fmt.Sprintf(`Timings:
    pdfInit:     %v
    header:      %v
    candidates:  %v
    measures:    %v
    footers:     %v
    output:      %v
    total:       %v
	`,
		self.pdfInit.Sub(self.start),
		self.header.Sub(self.pdfInit),
		self.candidates.Sub(self.header),
		self.measures.Sub(self.candidates),
		self.footers.Sub(self.measures),
		self.output.Sub(self.footers),
		self.output.Sub(self.start),
	)
}

type Renderer struct {
	perf   timings
	params PrintParams

	gridPositions []elections.GridPosition

	frame       Rect
	langCode    string
	optionAlign string

	bubbleSizeHalf Vec2
	gridCellCount  Vec2
	gridP1         Vec2
	gridP2         Vec2
	gridSize       Vec2
	gridSpacing    Vec2
	markSizeHalf   Vec2

	cfg      *Cfg
	doc      *scribe.Scribe
	election *elections.Election
	printer  *PrinterHmpb

	bubbleRadius                 float32
	bubbleOffsetY                float32
	bubbleWriteInOffsetY         float32
	yContentMax                  float32
	yContentMin                  float32
	yEndCandidateContests        float32
	yFooterFront                 float32
	yFooterBack                  float32
	widthContestCandidate        float32
	widthContestCandidateContent float32
	widthContestYesNo            float32
	widthContestYesNoContent     float32
	widthOptionCandidate         float32
	widthOptionYesNo             float32
	writeInLineOffsetY           float32

	col        uint8
	langDual   bool
	lastPageNo uint8
	pageSide   PageSide
}

type Lang uint8

const (
	LangPrimary Lang = iota
	LangSecondary
)

type PageSide uint8

const (
	PageSideBack  PageSide = 0
	PageSideFront PageSide = 1
)

func (side PageSide) String() string {
	if side == PageSideBack {
		return "back"
	}

	return "front"
}

var (
	pageSizeCustom17 = scribe.PageSize{Wd: 8.5 * Inch, Ht: 17 * Inch}
	pageSizeCustom19 = scribe.PageSize{Wd: 8.5 * Inch, Ht: 19 * Inch}
	pageSizeCustom22 = scribe.PageSize{Wd: 8.5 * Inch, Ht: 22 * Inch}
)

func (r *Renderer) init() (*elections.BallotStyle, error) {
	if logPerf {
		r.perf = timings{start: time.Now()}
	}

	style := r.election.BallotStyle(r.params.StyleId)
	if style == nil {
		return nil, ErrBallotStyleInvalid
	}

	r.gridPositions = make(
		[]elections.GridPosition,
		0,
		len(r.election.Contests),
	)

	r.langCode = style.LanguagePrimary()
	r.langDual = r.langCode != "en"

	var pageSize scribe.PageSize
	switch r.election.BallotLayout.PaperSize {
	case elections.PaperSizeLetter:
		pageSize = scribe.PageSizeLetter
	case elections.PaperSizeLegal:
		pageSize = scribe.PageSizeLegal
	case elections.PaperSizeCustom17:
		pageSize = pageSizeCustom17
	case elections.PaperSizeCustom19:
		pageSize = pageSizeCustom19
	case elections.PaperSizeCustom22:
		pageSize = pageSizeCustom22
	default:
		log.Panicln("unexpected paper size", r.election.BallotLayout.PaperSize)
	}

	r.doc = scribe.NewCustom(&scribe.InitType{
		OrientationStr: scribe.OrientationPortrait,
		UnitStr:        scribe.UnitPoint,
		Size:           pageSize,
	})
	r.doc.SetAutoPageBreak(false, 0)
	r.doc.SetCatalogSort(true)
	r.doc.SetCellMargin(0)
	r.doc.SetCompression(!r.params.NoCompress)
	r.doc.SetCreationDate(time.Unix(0, 0).UTC())
	r.doc.SetLineWidth(BorderM)
	r.doc.SetMargins(0, 0, 0)
	r.doc.SetModificationDate(time.Unix(0, 0).UTC())

	pageWidth, pageHeight := r.doc.GetPageSize()

	r.markSizeHalf = r.cfg.Grid.MarkSize.Mul(Vec2{0.5, 0.5})
	r.gridP1 = r.cfg.PrintMargin
	r.gridP2 = Vec2{pageWidth, pageHeight}.
		Sub(r.cfg.PrintMargin).
		Sub(r.cfg.Grid.MarkSize)
	r.gridSize = r.gridP2.Sub(r.gridP1)

	r.bubbleSizeHalf = r.cfg.BubbleSize.Mul(Vec2{0.5, 0.5})

	// Corresponds to the NH Accuvote ballot grid, which we mimic so that our
	// interpreter can support both Accuvote-style ballots and our ballots.
	// This formula is replicated in libs/ballot-interpreter/src/ballot_card.rs.
	const GridCellsPerInch = 4.0
	const GridCellsPerPt = GridCellsPerInch / Inch
	r.gridCellCount = Vec2{
		float32(math.Ceil(float64(pageWidth) * GridCellsPerPt)),
		float32(math.Ceil(float64(pageHeight)*GridCellsPerPt) - 3),
	}

	r.gridSpacing = r.gridP2.Sub(r.gridP1).
		Add(r.cfg.Grid.MarkSize).
		Sub(r.cfg.Grid.MarkSize.Mul(r.gridCellCount)).
		Div(r.gridCellCount.Sub(Vec2{1, 1}))

	r.frame.Origin = r.gridP1.
		Add(r.cfg.Grid.MarkSize).
		Add(r.cfg.Padding)
	r.frame.Size = r.gridP2.
		Sub(r.cfg.Padding).
		Sub(r.frame.Origin)

	yFrameMax := r.frame.Origin.Y() + r.frame.Size.Y()
	r.yFooterBack = yFrameMax - r.cfg.QrSize
	r.yFooterFront = r.yFooterBack - r.cfg.FontSize.Caption
	if r.cfg.NoMetadata {
		r.yFooterFront = r.yFooterBack
	}

	r.widthContestCandidate =
		(r.frame.Size.X() -
			(float32(r.cfg.ColCountCandidate-1) * r.cfg.Padding.X())) /
			float32(r.cfg.ColCountCandidate)

	r.widthContestCandidateContent =
		r.widthContestCandidate - 2*r.cfg.PaddingBox.X()

	r.widthOptionCandidate = r.widthContestCandidateContent -
		r.cfg.PaddingBox.X() -
		r.cfg.BubbleSize.X()

	r.widthContestYesNo =
		(r.frame.Size.X() -
			(float32(r.cfg.ColCountYesNo-1) * r.cfg.Padding.X())) /
			float32(r.cfg.ColCountYesNo)

	r.widthContestYesNoContent = r.widthContestYesNo - 2*r.cfg.PaddingBox.X()

	r.widthOptionYesNo = r.widthContestYesNoContent -
		r.cfg.PaddingBox.X() -
		r.cfg.BubbleSize.X()

	r.bubbleRadius = 0.5 * r.cfg.BubbleSize.Y()
	r.bubbleOffsetY = 0.5*r.cfg.FontSize.Base -
		0.5*r.cfg.BubbleSize.Y() +
		r.cfg.BubbleLnWidth

	r.writeInLineOffsetY = r.cfg.WriteInHeight - r.cfg.LnHeight.Caption

	r.bubbleWriteInOffsetY = r.writeInLineOffsetY -
		r.cfg.BubbleSize.Y() -
		r.cfg.OptionSpacing

	r.optionAlign = "L"
	if r.cfg.BubbleAlignRight {
		r.optionAlign = "R"
	}

	r.pageAdd()
	r.doc.UseTemplate(template)

	if logPerf {
		r.perf.pdfInit = time.Now()
	}

	return style, nil
}

func (r *Renderer) render() error {
	style, err := r.init()
	if err != nil {
		return err
	}

	r.doc.SetXY(
		r.frame.Origin.X()+r.cfg.SealSize+r.cfg.Padding.X(),
		r.frame.Origin.Y(),
	)

	var ballotType string
	if r.params.Official {
		var key string

		switch r.params.Type {
		case elections.BallotTypeAbsentee:
			key = "hmpbOfficialAbsenteeBallot"
		case elections.BallotTypePrecinct:
			key = "hmpbOfficialBallot"
		case elections.BallotTypeProvisional:
			key = "hmpbOfficialProvisionalBallot"
		default:
			panic("invalid ballot type")
		}

		ballotType = r.stringPrimary(key)
	} else {
		var key string

		switch r.params.Type {
		case elections.BallotTypeAbsentee:
			key = "hmpbTestAbsenteeBallot"
		case elections.BallotTypePrecinct:
			key = "hmpbTestBallot"
		case elections.BallotTypeProvisional:
			key = "hmpbTestProvisionalBallot"
		default:
			panic("invalid ballot type")
		}

		ballotType = r.stringPrimary(key)
	}

	r.h1(LangPrimary, 4*Inch, "L", []string{ballotType})
	r.h2(LangPrimary, 4*Inch, "L", []string{cmp.Or(
		r.stringPrimary("electionTitle"),
		r.election.Title,
	)})
	r.h2(LangPrimary, 4*Inch, "L", []string{cmp.Or(
		r.stringPrimary("electionDate"),
		r.election.DateLong,
	)})
	r.regular(LangPrimary, 4*Inch, "L", []string{
		cmp.Or(r.stringPrimary("countyName"), r.election.County.Name) +
			", " +
			cmp.Or(r.stringPrimary("stateName"), r.election.State),
	})

	y := r.doc.GetY()
	heightHeader := y - r.frame.Origin.Y()
	if err = r.seal(r.frame.Origin, heightHeader); err != nil {
		return err
	}

	r.doc.SetXY(r.frame.Origin.X(), y+r.cfg.Padding.Y())
	r.instructions()

	if logPerf {
		r.perf.header = time.Now()
	}

	r.yContentMin = r.doc.GetY() + r.cfg.Padding.Y()
	r.doc.SetXY(r.frame.Origin.X(), r.yContentMin)

	r.yEndCandidateContests = r.yContentMin
	widthCandidateColAndPadding := r.widthContestCandidate + r.cfg.Padding.X()

	contests := r.election.BallotStyleContests(style)
	for _, contest := range contests {
		if contest.Type != elections.ContestTypeCandidate {
			continue
		}

		r.doc.SetXY(
			r.frame.Origin.X()+(float32(r.col)*(widthCandidateColAndPadding)),
			r.doc.GetY(),
		)
		if err = r.contestCandidate(contest); err != nil {
			return err
		}
	}

	r.col = 0
	r.doc.SetXY(r.frame.Origin.X(), r.yEndCandidateContests)
	widthYesNoColAndPadding := r.widthContestYesNo + r.cfg.Padding.X()

	if logPerf {
		r.perf.candidates = time.Now()
	}

	for _, contest := range contests {
		if contest.Type != elections.ContestTypeYesNo {
			continue
		}

		r.doc.SetXY(
			r.frame.Origin.X()+(float32(r.col)*(widthYesNoColAndPadding)),
			r.doc.GetY(),
		)
		if err = r.contestYesNo(contest); err != nil {
			return err
		}
	}

	if logPerf {
		r.perf.measures = time.Now()
	}

	r.lastPageNo = uint8(r.doc.PageNo())

	// Blank last page note:
	if r.pageSide == PageSideFront {
		r.pageAdd()
		r.doc.MoveTo(
			r.frame.Origin.X(),
			r.frame.Origin.Y()+0.5*(r.frame.Size.Y()-r.cfg.LnHeight.H1),
		)
		r.h1(
			LangPrimary,
			r.frame.Size.X(),
			"C",
			[]string{r.stringPrimary("hmpbPageIntentionallyBlank")},
		)
	}

	return nil
}

func (r *Renderer) Finalize(
	writer io.Writer,
	electionHash []byte,
	electionHashHex string,
) error {
	encodedMetadata, err := EncodeMetadata(r.election, Metadata{
		Hash:          electionHash,
		BallotStyleId: r.params.StyleId,
		BallotType:    r.params.Type,
		PrecinctId:    r.params.PrecinctId,
		Official:      r.params.Official,
		PageCount:     uint8(r.doc.PageCount()),
	})
	if err != nil {
		return err
	}
	if err = r.qrRegister(encodedMetadata); err != nil {
		return err
	}

	precinct := r.election.Precinct(r.params.PrecinctId)
	for i := range r.doc.PageCount() {
		r.doc.SetPage(i + 1)
		if err := r.footer(precinct, electionHashHex); err != nil {
			return err
		}
	}

	if logPerf {
		r.perf.footers = time.Now()
	}

	err = r.doc.Output(writer)

	if logPerf {
		r.perf.output = time.Now()
		fmt.Println(r.perf)
	}

	return err
}

func (r *Renderer) Layout() elections.GridLayout {
	return elections.GridLayout{
		BallotStyleId:              r.params.StyleId,
		OptionBoundsFromTargetMark: elections.Outset{}, // [TODO]
		GridPositions:              r.gridPositions,
	}
}

func (r *Renderer) MarkVotes(votes elections.Votes) {
	for _, pos := range r.gridPositions {
		pageNum := pos.SheetNumber * 2
		if pos.Side == "front" {
			pageNum -= 1
		}

		contestVotes, ok := votes[pos.ContestId]
		if !ok {
			continue
		}

		mark := markInfo(contestVotes, pos)
		if !mark.marked {
			continue
		}

		r.doc.SetPage(int(pageNum))

		gridPos := Vec2{pos.Column, pos.Row}
		bubbleOrigin := r.fromGrid(gridPos).Sub(r.bubbleSizeHalf)
		r.bubbleShapeFilled(bubbleOrigin)

		if mark.writeInName == "" {
			continue
		}

		// Add write-in candidate name within the configured search area:

		writeInArea := r.fromGrid(Vec2{
			mark.writeInArea.Width,
			mark.writeInArea.Height,
		})
		writeInOrigin := r.fromGrid(Vec2{
			mark.writeInArea.X,
			mark.writeInArea.Y,
		}.Add(gridPos))
		r.doc.SetXY(
			writeInOrigin.X(),
			writeInOrigin.Y()+0.5*(writeInArea.Y()-r.cfg.FontSize.Base),
		)
		r.bold(
			LangSecondary,
			writeInArea.X(),
			r.optionAlign,
			[]string{mark.writeInName},
		)
	}
}

type MarkInfo struct {
	marked      bool
	writeInArea elections.Rect
	writeInName string
}

func markInfo(votes []elections.Vote, gridPos elections.GridPosition) (
	info MarkInfo,
) {
	for _, vote := range votes {
		if gridPos.Type == elections.GridPositionTypeWriteIn {
			if vote.WriteInName == "" ||
				vote.WriteInIndex != uint8(gridPos.WriteInIndex) {
				continue
			}

			info.marked = true
			info.writeInName = vote.WriteInName
			info.writeInArea = gridPos.WriteInArea

			return
		}

		if vote.YesNoOptionId != gridPos.OptionId &&
			vote.CandidateId != gridPos.OptionId {
			continue
		}

		info.marked = true
		return
	}

	return
}

type BoxParams struct {
	Pos Vec2

	HeightContent float32
	HeightHeader  float32
	Width         float32
}

func (r *Renderer) box(params BoxParams) {
	if params.HeightHeader > 0 {
		r.boxHeader(Rect{
			Origin: params.Pos,
			Size: Vec2{
				params.Width,
				params.HeightHeader,
			},
		})
	}

	r.boxOutline(Rect{
		Origin: params.Pos,
		Size: Vec2{
			params.Width,
			params.HeightHeader + params.HeightContent,
		},
	})
}

func (r *Renderer) boxHeader(bounds Rect) {
	r.doc.SetFillColor(r.cfg.Color.Tint.Rgb())
	r.doc.Rect(
		bounds.Origin.X(), bounds.Origin.Y(), bounds.Size.X(), bounds.Size.Y(),
		"F",
	)
}

func (r *Renderer) boxOutline(bounds Rect) {
	yOutline := bounds.Origin.Y() + BoxBorderTopWidthHalf
	r.doc.SetLineWidth(BoxBorderWidth)
	r.doc.SetLineJoinStyle("round")
	r.doc.Rect(
		bounds.Origin.X()+BoxBorderWidthHalf,
		yOutline,
		bounds.Size.X()-BoxBorderWidth,
		bounds.Size.Y()-
			BoxBorderTopWidthHalf-
			BoxBorderWidthHalf,
		"D",
	)

	r.doc.SetLineWidth(BoxBorderTopWidth)
	r.doc.Line(
		bounds.Origin.X(),
		yOutline,
		bounds.Origin.X()+bounds.Size.X(),
		yOutline,
	)
}

func (r *Renderer) bubbleOption(
	pos Vec2,
	contest *elections.Contest,
	optionId string,
) {
	r.bubbleShape(pos, bubbleStyleEmpty)

	gridPos := r.toGrid(pos.Add(r.bubbleSizeHalf))
	r.gridPositions = append(r.gridPositions, elections.GridPosition{
		Type:        elections.GridPositionTypeOption,
		SheetNumber: uint32(r.doc.PageNo()+1) / 2,
		Side:        r.pageSide.String(),
		Row:         gridPos.Y(),
		Column:      gridPos.X(),
		ContestId:   contest.Id,
		GridPositionOptionId: elections.GridPositionOptionId{
			OptionId: optionId,
		},
	})
}

func (r *Renderer) bubbleOptionFilled(
	pos Vec2,
	contest *elections.Contest,
	optionId string,
) {
	r.bubbleShapeFilled(pos)

	gridPos := r.toGrid(pos.Add(r.bubbleSizeHalf))
	r.gridPositions = append(r.gridPositions, elections.GridPosition{
		Type:        elections.GridPositionTypeOption,
		SheetNumber: uint32(r.doc.PageNo()+1) / 2,
		Side:        r.pageSide.String(),
		Row:         gridPos.Y(),
		Column:      gridPos.X(),
		ContestId:   contest.Id,
		GridPositionOptionId: elections.GridPositionOptionId{
			OptionId: optionId,
		},
	})
}

func (r *Renderer) bubbleWritein(
	pos Vec2,
	contest *elections.Contest,
	ixWritein uint32,
	area Rect,
) {
	r.bubbleShape(pos, bubbleStyleEmpty)

	gridPos := r.toGrid(pos.Add(r.bubbleSizeHalf))

	writeInAreaOnGrid := r.toGrid(area.Size)
	writeInOriginOnGrid := r.toGrid(area.Origin).Sub(gridPos)

	r.gridPositions = append(r.gridPositions, elections.GridPosition{
		Type:        elections.GridPositionTypeWriteIn,
		SheetNumber: uint32(r.doc.PageNo()+1) / 2,
		Side:        r.pageSide.String(),
		Row:         gridPos.Y(),
		Column:      gridPos.X(),
		ContestId:   contest.Id,
		GridPositionWriteInIndex: elections.GridPositionWriteInIndex{
			WriteInIndex: ixWritein,
			WriteInArea: elections.Rect{
				Height: writeInAreaOnGrid.Y(),
				Width:  writeInAreaOnGrid.X(),
				X:      writeInOriginOnGrid.X(),
				Y:      writeInOriginOnGrid.Y(),
			},
		},
	})
}

type bubbleStyle string

const (
	bubbleStyleFilled = "DF"
	bubbleStyleEmpty  = "D"
)

func (r *Renderer) bubbleShape(pos Vec2, style bubbleStyle) {
	r.doc.SetLineWidth(r.cfg.BubbleLnWidth)
	r.doc.RoundedRectExt(
		pos.X(),
		pos.Y()+r.bubbleOffsetY,
		r.cfg.BubbleSize.X(),
		r.cfg.BubbleSize.Y(),
		r.bubbleRadius,
		r.bubbleRadius,
		r.bubbleRadius,
		r.bubbleRadius,
		string(style),
	)
}

func (r *Renderer) bubbleShapeFilled(pos Vec2) {
	r.doc.SetFillColor(r.cfg.Color.Fg.Rgb())
	r.bubbleShape(pos, bubbleStyleFilled)
}

func (r *Renderer) fromGrid(pos Vec2) Vec2 {
	return r.gridP1.
		Add(r.markSizeHalf).
		Add(pos.Mul(r.cfg.Grid.MarkSize.Add(r.gridSpacing)))
}

func (r *Renderer) toGrid(pos Vec2) Vec2 {
	return pos.
		Sub(r.gridP1.Add(r.markSizeHalf)).
		Div(r.gridSize).
		Mul(r.gridCellCount.Sub(Vec2{1, 1}))
}

func (r *Renderer) contestCandidate(contest *elections.Contest) error {
	if contest.Type != elections.ContestTypeCandidate {
		panic("expected candidate contest")
	}

	heightHeader := 2 * r.cfg.PaddingBox.Y()

	r.doc.SetMeasurementFont(r.fontH3(LangPrimary))

	stringKeyTitle := "contestTitle." + contest.Id
	linesTitle := r.doc.TextSplit(
		cmp.Or(r.stringPrimary(stringKeyTitle), contest.Title),
		r.widthContestCandidateContent,
	)

	heightHeader += float32(len(linesTitle)) * r.cfg.LnHeight.H3

	linesInstruct := []string{}
	instructStringKeys, err := r.cfg.CandidateContestInstructions(contest.Seats)
	if err != nil {
		return err
	}

	r.doc.SetMeasurementFont(r.fontRegular(LangPrimary))
	for _, k := range instructStringKeys {
		linesInstruct = append(linesInstruct, r.doc.TextSplit(
			r.stringPrimary(k),
			r.widthContestCandidateContent,
		)...)
	}

	heightHeader += float32(len(linesInstruct)-1)*r.cfg.LnHeight.Base +
		r.cfg.FontSize.Base

	var heightCandidates float32 = 0.0

	linesCandidates := make([]CandidateLines, len(contest.Candidates))
	for i, candidate := range contest.Candidates {
		heightCandidates += r.cfg.OptionSpacing

		stringKeyParty := ""
		partyNameDefault := ""
		if len(candidate.PartyIds) > 0 {
			stringKeyParty = "partyName." + candidate.PartyIds[0]
			partyNameDefault = r.election.PartyName(candidate.PartyIds[0])
		}

		lines := CandidateLines{}

		r.doc.SetMeasurementFont(r.fontBold(LangSecondary))
		lines.name = r.doc.TextSplit(candidate.Name, r.widthOptionCandidate)
		heightCandidates += float32(len(lines.name)) * r.cfg.LnHeight.Base

		r.doc.SetMeasurementFont(r.fontRegular(LangPrimary))
		lines.party = r.doc.TextSplit(
			cmp.Or(r.stringPrimary(stringKeyParty), partyNameDefault),
			r.widthOptionCandidate,
		)
		heightCandidates += float32(len(lines.party)) * r.cfg.LnHeight.Base
		heightCandidates += r.cfg.OptionSpacing

		linesCandidates[i] = lines
	}

	writeInCount := uint8(0)
	if contest.AllowWriteIns {
		writeInCount = contest.Seats
		heightCandidates += float32(writeInCount) *
			(r.cfg.WriteInHeight + 2*r.cfg.OptionSpacing)
	}

	heightContest := heightHeader + heightCandidates

	pos := Vec2{r.doc.GetX(), r.doc.GetY()}
	yBottom := pos.Y() + heightContest

	canFit := false
	for {
		if yBottom <= r.yContentMax {
			canFit = true
			break
		}

		if r.col < r.cfg.ColCountCandidate-1 {
			r.col += 1

			pos[0] = r.frame.Origin.X() +
				(float32(r.col) * (r.widthContestCandidate + r.cfg.Padding.X()))

			pos[1] = r.yContentMin

			if heightContest <= r.yContentMax-r.yContentMin {
				canFit = true
				break
			}
		}

		r.pageAdd()
		pos[0] = r.frame.Origin.X()
		pos[1] = r.yContentMin
		if heightContest <= r.yContentMax-r.yContentMin {
			canFit = true
			break
		}

		break
	}
	if !canFit {
		return fmt.Errorf("contest too tall to fit: %s", contest.Title)
	}

	r.box(BoxParams{
		Pos:           pos,
		HeightContent: heightCandidates,
		HeightHeader:  heightHeader,
		Width:         r.widthContestCandidate,
	})

	posContent := pos.Add(r.cfg.PaddingBox)
	r.doc.MoveTo(posContent.Spread())

	r.h3(LangPrimary, r.widthContestCandidateContent, "L", linesTitle)
	r.regular(LangPrimary, r.widthContestCandidateContent, "L", linesInstruct)

	xCandidate := posContent.X()
	xBubble := posContent.X() +
		r.widthOptionCandidate +
		r.cfg.PaddingBox.X() +
		0.5*r.cfg.BubbleLnWidth

	if !r.cfg.BubbleAlignRight {
		xCandidate += r.cfg.BubbleSize.X() + r.cfg.PaddingBox.X()
		xBubble = posContent.X() + 0.5*r.cfg.BubbleLnWidth
	}

	r.doc.MoveTo(posContent.X(), pos.Y()+heightHeader)
	for i, lines := range linesCandidates {
		if i != 0 {
			// Top border:
			r.doc.SetLineWidth(Px)
			r.doc.SetDrawColor(r.cfg.Color.OptionDivider.Rgb())
			r.doc.Line(
				pos.X()+Px,
				r.doc.GetY(),
				pos.X()+r.widthContestCandidate-Px,
				r.doc.GetY(),
			)
			r.doc.SetDrawColor(0, 0, 0)
		}

		// Top padding:
		r.doc.Ln(r.cfg.OptionSpacing)
		r.doc.SetX(xCandidate)

		// Cnadidate Option:
		r.bubbleOption(
			Vec2{xBubble, r.doc.GetY()},
			contest,
			contest.Candidates[i].Id,
		)
		r.bold(LangSecondary, r.widthOptionCandidate, r.optionAlign, lines.name)
		r.regular(
			LangPrimary,
			r.widthOptionCandidate,
			r.optionAlign,
			lines.party,
		)

		// Bottom padding:
		r.doc.Ln(r.cfg.OptionSpacing)
		r.doc.SetX(xCandidate)

	}

	for i := range writeInCount {
		// Top border:
		r.doc.SetLineWidth(Px)
		r.doc.SetDrawColor(r.cfg.Color.OptionDivider.Rgb())
		r.doc.Line(
			pos.X()+Px,
			r.doc.GetY(),
			pos.X()+r.widthContestCandidate-Px,
			r.doc.GetY(),
		)
		r.doc.SetDrawColor(0, 0, 0)

		// Top padding:
		r.doc.Ln(r.cfg.OptionSpacing)
		r.doc.SetX(xCandidate)

		yStart := r.doc.GetY()

		// Write-in option area:
		r.doc.SetDashPattern([]float32{3, 2}, 0)
		r.doc.SetLineWidth(1 * Px)
		r.doc.Line(
			xCandidate,
			yStart+r.writeInLineOffsetY,
			xCandidate+r.widthOptionCandidate,
			yStart+r.writeInLineOffsetY,
		)
		r.doc.SetDashPattern(nil, 0)

		// Write-in bubble:
		r.bubbleWritein(
			Vec2{xBubble, yStart + r.bubbleWriteInOffsetY},
			contest,
			uint32(i),
			Rect{
				Origin: Vec2{xCandidate, yStart},
				Size: Vec2{
					r.widthOptionCandidate,
					r.writeInLineOffsetY,
				},
			},
		)

		// Write-in label:
		r.doc.Ln(r.writeInLineOffsetY + r.cfg.WriteInLabelMargin)
		r.doc.SetX(xCandidate)
		r.caption(LangPrimary, r.widthOptionCandidate, r.optionAlign, []string{
			r.stringPrimary("hmpbWriteIn"),
		})

		// Bottom padding:
		r.doc.MoveTo(
			xCandidate,
			yStart+r.cfg.WriteInHeight+r.cfg.OptionSpacing,
		)
	}

	// Move to end of contest:
	r.doc.SetXY(pos.X(), pos.Y()+heightContest+r.cfg.Padding.Y())
	r.yEndCandidateContests = float32(math.Max(
		float64(r.yEndCandidateContests),
		float64(r.doc.GetY()),
	))

	return nil
}

type CandidateLines struct {
	name  []string
	party []string
}

func (r *Renderer) contestYesNo(contest *elections.Contest) error {
	if contest.Type != elections.ContestTypeYesNo {
		panic("expected yes/no contest")
	}

	r.doc.SetMeasurementFont(r.fontH2(LangPrimary))

	stringKeyTitle := "contestTitle." + contest.Id
	title := cmp.Or(r.stringPrimary(stringKeyTitle), contest.Title)
	linesTitle := r.doc.TextSplit(title, r.widthContestYesNoContent)

	heightHeader :=
		2*r.cfg.PaddingBox.Y() + float32(len(linesTitle))*r.cfg.LnHeight.H2

	var richText RichText
	var err error

	stringKeyDesc := "contestDescription." + contest.Id
	desc := cmp.Or(r.stringPrimary(stringKeyDesc), contest.Description)
	if desc == "" {
		desc = contest.Description
	}
	if len(desc) > 0 && desc[0] == '<' {
		richText, err = r.richTextLines(RichTextLinesParams{
			text:  desc,
			width: r.widthContestYesNoContent,
		})
		if err != nil {
			return fmt.Errorf("rich text parsing failed: %w", err)
		}
	} else {
		r.doc.SetMeasurementFont(r.fontRegular(LangPrimary))
		lines := r.doc.TextSplit(desc, r.widthContestYesNoContent)
		for _, line := range lines {
			richText.lines = []HtmlLine{
				HtmlText{text: line},
				HtmlNewline{},
			}
		}
		richText.height = float32(
			len(lines),
		)*r.cfg.LnHeight.Base + 3*r.cfg.OptionSpacing

	}

	idOptionA := contest.YesOption.Id
	idOptionB := contest.NoOption.Id

	stringKeyOptionA := "contestOptionLabel." + idOptionA
	stringKeyOptionB := "contestOptionLabel." + idOptionB

	r.doc.SetMeasurementFont(r.fontBold(LangPrimary))
	linesOptionA := r.doc.TextSplit(
		cmp.Or(r.stringPrimary(stringKeyOptionA), contest.YesOption.Label),
		r.widthOptionYesNo,
	)
	linesOptionB := r.doc.TextSplit(
		cmp.Or(r.stringPrimary(stringKeyOptionB), contest.NoOption.Label),
		r.widthOptionYesNo,
	)

	heightOptionA := float32(
		len(linesOptionA),
	)*r.cfg.LnHeight.Base + 2*r.cfg.OptionSpacing

	heightOptionB := float32(
		len(linesOptionB),
	)*r.cfg.LnHeight.Base + 2*r.cfg.OptionSpacing

	heightContent := richText.height + heightOptionA + heightOptionB
	heightContest := heightHeader + heightContent

	pos := Vec2{r.doc.GetX(), r.doc.GetY()}
	yBottom := pos.Y() + heightContest
	firstChunkHeight := heightContest
	fitsSingleColumn := false
	for {
		if yBottom <= r.yContentMax {
			fitsSingleColumn = true
			break
		}

		if r.col < r.cfg.ColCountYesNo-1 {
			r.col += 1

			pos[0] = r.frame.Origin.X() +
				(float32(r.col) * (r.widthContestYesNo + r.cfg.Padding.X()))

			pos[1] = r.yEndCandidateContests

			if heightContest <= r.yContentMax-r.yEndCandidateContests {
				fitsSingleColumn = true
				break
			}
		}

		r.pageAdd()
		pos[0] = r.frame.Origin.X()
		pos[1] = r.yContentMin
		if heightContest <= r.yContentMax-r.yContentMin {
			fitsSingleColumn = true
			break
		}

		firstChunkHeight = r.yContentMax - r.yContentMin
		break
	}

	r.boxHeader(Rect{
		Origin: pos,
		Size: Vec2{
			r.widthContestYesNo,
			heightHeader,
		},
	})
	if fitsSingleColumn {
		r.boxOutline(Rect{
			Origin: pos,
			Size:   Vec2{r.widthContestYesNo, firstChunkHeight},
		})
	}

	// Title:
	posContent := pos.Add(r.cfg.PaddingBox)
	r.doc.MoveTo(posContent.Spread())
	r.h2(LangPrimary, r.widthContestYesNoContent, "L", linesTitle)

	// Description top padding:
	r.doc.MoveTo(posContent.X(), pos.Y()+heightHeader)
	r.doc.Ln(r.cfg.OptionSpacing)
	r.doc.SetX(posContent.X())

	// Description:
	r.doc.SetFont(r.fontRegular(LangPrimary))
	xDesc := posContent.X()

	var indentCount uint8 = 0
	indentSize := func() float32 {
		return float32(indentCount) * r.cfg.IndentSize
	}

	fillCell := false
	cellPadding := Vec2{}
	cellWidth := r.widthContestYesNoContent
	var tableCur HtmlTable
	ixTableCol := 0

	colBreak := func() {
		heightPreviousCol := (r.doc.GetY() - pos.Y()) +
			r.cfg.OptionSpacing +
			2*r.cfg.OptionSpacing +
			r.cfg.LnHeight.Base

		heightPreviousColFooter := r.cfg.LnHeight.Base + 2*r.cfg.OptionSpacing
		yPreviousColFooter := r.doc.GetY() + r.cfg.OptionSpacing
		r.boxHeader(Rect{
			Origin: Vec2{pos.X(), yPreviousColFooter},
			Size:   Vec2{r.widthContestYesNo, heightPreviousColFooter},
		})

		noteContinued := "Continues in next column..."
		if r.col == r.cfg.ColCountYesNo-1 {
			noteContinued = "Continues on next page..."
		}

		fontIdPrev, fontStylePrev, fontSizePrev := r.doc.CurrentFont()
		r.doc.SetXY(posContent.X(), yPreviousColFooter+r.cfg.OptionSpacing)
		r.bold(
			LangPrimary,
			r.widthContestYesNoContent,
			"R",
			[]string{noteContinued},
		)

		r.boxOutline(Rect{
			Origin: pos,
			Size:   Vec2{r.widthContestYesNo, heightPreviousCol},
		})

		if r.col < r.cfg.ColCountYesNo-1 {
			r.col += 1
			pos = Vec2{
				r.frame.Origin.X() +
					(float32(r.col) *
						(r.widthContestYesNo + r.cfg.Padding.X())),
				r.yEndCandidateContests,
			}
		} else {
			r.pageAdd()
			pos = Vec2{r.frame.Origin.X(), r.yContentMin}
		}

		r.doc.SetMeasurementFont(r.fontH2(LangPrimary))
		linesTitle = r.doc.TextSplit(
			title+" (Continued)",
			r.widthContestYesNoContent,
		)
		heightHeader =
			2*r.cfg.PaddingBox.Y() + float32(len(linesTitle))*r.cfg.LnHeight.H2

		r.boxHeader(Rect{
			Origin: pos,
			Size:   Vec2{r.widthContestYesNo, heightHeader},
		})

		posContent = pos.Add(r.cfg.PaddingBox)
		r.doc.MoveTo(posContent.Spread())
		r.h2(LangPrimary, r.widthContestYesNoContent, "L", linesTitle)

		r.doc.SetFont(fontIdPrev, fontStylePrev, fontSizePrev)

		r.doc.MoveTo(posContent.X(), pos.Y()+heightHeader)
		r.doc.Ln(r.cfg.OptionSpacing)

		xDesc = posContent.X()
		r.doc.SetX(xDesc)
	}

	for _, line := range richText.lines {
		switch l := line.(type) {
		case HtmlFontBold:
			r.doc.SetFont(r.fontBold(LangPrimary))
		case HtmlFontBoldEnd:
			r.doc.SetFont(r.fontRegular(LangPrimary))

		case HtmlFontItalic:
			r.doc.SetFont(r.fontItalic(LangPrimary))
		case HtmlFontItalicEnd:
			r.doc.SetFont(r.fontRegular(LangPrimary))

		case HtmlFontStrike:
			r.doc.StyleAdd(scribe.FontStyleS)
		case HtmlFontStrikeEnd:
			r.doc.StyleRemove(scribe.FontStyleS)

		case HtmlFontUnderline:
			r.doc.StyleAdd(scribe.FontStyleU)
		case HtmlFontUnderlineEnd:
			r.doc.StyleRemove(scribe.FontStyleU)

		case HtmlLiEnd:
			// No-op
		case HtmlLiStart:
			yEnd := r.doc.GetY() +
				r.cfg.LnHeight.Base +
				r.cfg.OptionSpacing +
				2*r.cfg.OptionSpacing +
				2*r.cfg.OptionSpacing +
				2*r.cfg.LnHeight.Base
			if yEnd >= r.yContentMax {
				colBreak()
			}

			indent := indentSize()

			if l.number == "" {
				r.doc.SetFillColor(r.cfg.Color.Fg.Rgb())
				r.doc.Circle(
					xDesc+indent-(0.75*r.cfg.FontSize.Base),
					r.doc.GetY()+(0.5*r.cfg.FontSize.Base),
					0.25*r.cfg.FontSize.Base,
					"F",
				)
			} else {
				r.doc.SetX(xDesc)
				r.doc.CellFormat(
					indent-(0.25*r.cfg.FontSize.Base),
					r.cfg.LnHeight.Base,
					l.number,
					"", 0, "R", false, 0, "",
				)
			}

			r.doc.SetX(xDesc + indent)

		case HtmlListEnd:
			indentCount -= 1
		case HtmlListStart:
			indentCount += 1
			r.doc.SetX(xDesc + indentSize())

		case HtmlNewline:
			r.doc.Ln(r.cfg.LnHeight.Base)
			r.doc.SetX(xDesc + indentSize())

		case HtmlPara:
			r.doc.Ln(r.cfg.ParagraphGap)
			r.doc.SetX(xDesc + indentSize())

		case HtmlSvg:
			r.doc.SetFillColor(r.cfg.Color.Fg.Rgb())
			r.doc.SetDrawColor(r.cfg.Color.Fg.Rgb())
			r.doc.SVGBasicDraw(&l.src, 1, "F")

			r.doc.Ln(r.cfg.LnHeight.Base)
			r.doc.SetX(xDesc + indentSize())

		case HtmlText:
			r.doc.SetCellMargin(cellPadding.X())
			if len(l.lines) == 0 {
				r.doc.CellFormat(
					cellWidth-indentSize(),
					r.cfg.LnHeight.Base+2*cellPadding.Y(),
					l.text,
					"", 0, "L", fillCell, 0, "",
				)

				continue
			}

			isFirst := true
			for _, textLine := range l.lines {
				yEnd := r.doc.GetY() +
					r.cfg.LnHeight.Base +
					r.cfg.OptionSpacing +
					2*r.cfg.OptionSpacing +
					2*r.cfg.OptionSpacing +
					2*r.cfg.LnHeight.Base
				if yEnd >= r.yContentMax {
					colBreak()
					isFirst = true
				}

				if !isFirst {
					r.doc.Ln(r.cfg.LnHeight.Base)
					r.doc.SetX(xDesc + indentSize())
				}
				isFirst = false

				r.doc.CellFormat(
					cellWidth-indentSize(),
					r.cfg.LnHeight.Base+2*cellPadding.Y(),
					textLine,
					"", 0, "L", fillCell, 0, "",
				)
			}

		case HtmlTable:
			tableCur = l
			ixTableCol = 0

		case HtmlTh:
			fillCell = true
			r.doc.SetFillColor(r.cfg.Color.Tint.Rgb())
			cellWidth = tableCur.colWidths[ixTableCol] + 2*cellPadding.X()
			ixTableCol += 1

		case HtmlTd:
			cellWidth = tableCur.colWidths[ixTableCol] + 2*cellPadding.X()
			ixTableCol += 1

		case HtmlThEnd:
			fillCell = false

		case HtmlTr:
			cellPadding = r.cfg.PaddingTableCell

		case HtmlTrEnd:
			r.doc.Ln(r.cfg.LnHeight.Base + 2*r.cfg.PaddingTableCell.Y())
			r.doc.SetX(xDesc + indentSize())

			cellWidth = r.widthContestYesNoContent
			cellPadding = Vec2{}
			r.doc.SetCellMargin(0)

			ixTableCol = 0

		default:
			log.Panicf("unhandled rich text type: %T", l)
		}
	}

	// Calculate bubble position:
	xOption := posContent.X()
	xBubble := posContent.X() +
		r.widthOptionYesNo +
		r.cfg.PaddingBox.X() +
		0.5*r.cfg.BubbleLnWidth

	if !r.cfg.BubbleAlignRight {
		xOption += r.cfg.BubbleSize.X() + r.cfg.PaddingBox.X()
		xBubble = posContent.X() + 0.5*r.cfg.BubbleLnWidth
	}

	// Padding:
	r.doc.Ln(2 * r.cfg.OptionSpacing)
	r.doc.SetX(xOption)

	// Top border:
	r.doc.SetLineWidth(Px)
	r.doc.SetDrawColor(r.cfg.Color.OptionDivider.Rgb())
	r.doc.Line(
		pos.X()+Px,
		r.doc.GetY(),
		pos.X()+r.widthContestYesNo-Px,
		r.doc.GetY(),
	)
	r.doc.SetDrawColor(0, 0, 0)

	// Padding:
	r.doc.Ln(r.cfg.OptionSpacing)
	r.doc.SetX(xOption)

	// Option A:
	r.bubbleOption(Vec2{xBubble, r.doc.GetY()}, contest, contest.YesOption.Id)
	r.bold(LangPrimary, r.widthOptionYesNo, r.optionAlign, linesOptionA)

	// Padding:
	r.doc.Ln(r.cfg.OptionSpacing)
	r.doc.SetX(xOption)

	// Top border:
	r.doc.SetLineWidth(Px)
	r.doc.SetDrawColor(r.cfg.Color.OptionDivider.Rgb())
	r.doc.Line(
		pos.X()+Px,
		r.doc.GetY(),
		pos.X()+r.widthContestYesNo-Px,
		r.doc.GetY(),
	)
	r.doc.SetDrawColor(0, 0, 0)

	// Padding:
	r.doc.Ln(r.cfg.OptionSpacing)
	r.doc.SetX(xOption)

	// Option B:
	r.bubbleOption(Vec2{xBubble, r.doc.GetY()}, contest, contest.NoOption.Id)
	r.bold(LangPrimary, r.widthOptionYesNo, r.optionAlign, linesOptionB)

	// Padding:
	r.doc.Ln(r.cfg.OptionSpacing)
	r.doc.SetX(xOption)

	// Final outline for column-broken contests:
	yBottom = r.doc.GetY()
	if !fitsSingleColumn {
		r.boxOutline(Rect{
			Origin: pos,
			Size:   Vec2{r.widthContestYesNo, yBottom - pos.Y()},
		})
	}

	// Move to bottom of contest + padding:
	r.doc.Ln(r.cfg.Padding.Y())
	r.doc.SetX(xOption)

	return nil
}

func (r *Renderer) fontBold(lang Lang) (
	id scribe.FontId, style scribe.FontStyle, size float32,
) {
	style = scribe.FontStyleB
	id = r.fontId(lang, style)
	size = r.cfg.FontSize.Base
	return
}

func (r *Renderer) fontItalic(lang Lang) (
	id scribe.FontId, style scribe.FontStyle, size float32,
) {
	style = scribe.FontStyleI
	id = r.fontId(lang, style)
	size = r.cfg.FontSize.Base
	return
}

func (r *Renderer) fontCaption(lang Lang) (
	id scribe.FontId, style scribe.FontStyle, size float32,
) {
	style = scribe.FontStyleNone
	id = r.fontId(lang, style)
	size = r.cfg.FontSize.Caption
	return
}

func (r *Renderer) fontId(lang Lang, style scribe.FontStyle) scribe.FontId {
	langCode := r.langCode
	if lang == LangSecondary {
		langCode = "en"
	}

	switch langCode {
	case "zh-Hant":
		fallthrough
	case "zh-Hans":
		if style&scribe.FontStyleB != 0 {
			return FontIdNotoScBold
		}

		return FontIdNotoSc

	default:
		if style&scribe.FontStyleB != 0 {
			return FontIdRobotoBold
		}

		if style&scribe.FontStyleI != 0 {
			return FontIdRobotoItalic
		}

		return FontIdRoboto
	}
}

func (r *Renderer) fontH1(
	lang Lang,
) (id scribe.FontId, style scribe.FontStyle, size float32) {
	style = scribe.FontStyleB
	id = r.fontId(lang, style)
	size = r.cfg.FontSize.H1
	return
}

func (r *Renderer) fontH2(
	lang Lang,
) (id scribe.FontId, style scribe.FontStyle, size float32) {
	style = scribe.FontStyleB
	id = r.fontId(lang, style)
	size = r.cfg.FontSize.H2
	return
}

func (r *Renderer) fontH3(
	lang Lang,
) (id scribe.FontId, style scribe.FontStyle, size float32) {
	style = scribe.FontStyleB
	id = r.fontId(lang, style)
	size = r.cfg.FontSize.H3
	return
}

func (r *Renderer) fontH4(
	lang Lang,
) (id scribe.FontId, style scribe.FontStyle, size float32) {
	style = scribe.FontStyleB
	id = r.fontId(lang, style)
	size = r.cfg.FontSize.H4
	return
}

func (r *Renderer) fontPico(lang Lang) (
	id scribe.FontId, style scribe.FontStyle, size float32,
) {
	style = scribe.FontStyleNone
	id = r.fontId(lang, style)
	size = r.cfg.FontSize.Pico
	return
}

func (r *Renderer) fontRegular(lang Lang) (
	id scribe.FontId, style scribe.FontStyle, size float32,
) {
	style = scribe.FontStyleNone
	id = r.fontId(lang, style)
	size = r.cfg.FontSize.Base
	return
}

func (r *Renderer) fontTiny(lang Lang) (
	id scribe.FontId, style scribe.FontStyle, size float32,
) {
	style = scribe.FontStyleNone
	id = r.fontId(lang, style)
	size = r.cfg.FontSize.Tiny
	return
}

func (r *Renderer) fontTinyBold(lang Lang) (
	id scribe.FontId, style scribe.FontStyle, size float32,
) {
	style = scribe.FontStyleB
	id = r.fontId(lang, style)
	size = r.cfg.FontSize.Tiny
	return
}

func (r *Renderer) footer(
	precinct *elections.Precinct,
	electionHash string,
) error {
	strKeyFooter := "hmpbContinueVotingOnBack"
	y := r.yFooterFront
	iconSlotWidth := r.cfg.FooterIconSize + r.cfg.PaddingBox.X()

	isBack := r.doc.PageNo()%2 == 0
	if isBack {
		strKeyFooter = "hmpbContinueVotingOnNextSheet"
		y = r.yFooterBack
	}

	isLastPage := r.doc.PageNo() == int(r.lastPageNo)
	if isLastPage {
		strKeyFooter = "hmpbVotingComplete"
		iconSlotWidth = 0
	}

	isBlank := r.doc.PageNo() > int(r.lastPageNo)
	if isBlank {
		strKeyFooter = ""
	}

	r.doc.MoveTo(r.frame.Origin.X(), y)
	r.qrRender()

	qrSlotSize := r.cfg.QrSize + r.cfg.Padding.X()
	pos := Vec2{r.frame.Origin.X() + qrSlotSize, y}

	width := r.frame.Size.X() - qrSlotSize
	r.box(BoxParams{
		Pos:          pos,
		HeightHeader: r.cfg.QrSize,
		Width:        width,
	})

	r.doc.MoveTo(
		pos.X(),
		pos.Y()+0.5*(r.cfg.QrSize-r.cfg.LnHeight.H3)+BoxBorderTopWidthHalf,
	)
	r.doc.SetFont(r.fontH3(LangPrimary))
	r.doc.CellFormat(
		width-iconSlotWidth-r.cfg.PaddingBox.X(),
		r.cfg.LnHeight.H3,
		r.stringPrimary(strKeyFooter),
		"", 0, "R", false, 0, "",
	)

	// Page numbers:
	if !isBlank {
		r.doc.MoveTo(
			pos.X()+r.cfg.PaddingBox.X(),
			pos.Y()+
				BoxBorderTopWidthHalf+
				0.5*(r.cfg.QrSize-
					r.cfg.LnHeight.H1-
					r.cfg.LnHeight.Caption),
		)
		r.caption(
			LangPrimary,
			Inch,
			"L",
			[]string{r.stringPrimary("hmpbPage")},
		)
		r.doc.SetFont(r.fontH1(LangSecondary))
		r.doc.CellFormat(
			Inch,
			r.cfg.LnHeight.H1,
			strconv.FormatUint(
				uint64(r.doc.PageNo()),
				10,
			)+"/"+strconv.FormatUint(
				uint64(r.lastPageNo),
				10,
			),
			"", 0, "L", false, 0, "",
		)
	}

	// Continue icon:
	if !isBlank && !isLastPage {
		iconCenter := Vec2{
			pos.X() + width - r.cfg.PaddingBox.X() - (0.5 * r.cfg.FooterIconSize),
			pos.Y() + 0.5*r.cfg.QrSize,
		}
		r.doc.SetFillColor(r.cfg.Color.Fg.Rgb())
		r.doc.Circle(
			iconCenter.X(),
			iconCenter.Y(),
			0.5*r.cfg.FooterIconSize,
			"F",
		)
		r.doc.SetFillColor(0xff, 0xff, 0xff)
		r.doc.Rect(
			iconCenter.X()-0.3*r.cfg.FooterIconSize,
			iconCenter.Y()-0.1*r.cfg.FooterIconSize,
			0.3*r.cfg.FooterIconSize+0.25, // +nudge to merge with triangle:
			0.2*r.cfg.FooterIconSize,
			"F",
		)
		r.doc.MoveTo(
			iconCenter.X(),
			iconCenter.Y()-0.25*r.cfg.FooterIconSize,
		)
		r.doc.LineTo(
			iconCenter.X()+0.35*r.cfg.FooterIconSize,
			iconCenter.Y(),
		)
		r.doc.LineTo(
			iconCenter.X(),
			iconCenter.Y()+0.25*r.cfg.FooterIconSize,
		)
		r.doc.LineTo(
			iconCenter.X(),
			iconCenter.Y()-0.25*r.cfg.FooterIconSize,
		)
		r.doc.ClosePath()
		r.doc.DrawPath("F")
	}

	if isBack || r.cfg.NoMetadata {
		return nil
	}

	// Ballot metdata:

	r.doc.MoveTo(
		r.frame.Origin.X(),
		r.frame.Origin.Y()+r.frame.Size.Y()-0.5*r.cfg.FontSize.Caption,
	)
	r.doc.SetFont(r.fontTiny(LangSecondary))
	widthLabelElection := r.doc.GetStringWidth("Election: ")
	widthLabelBallotStyle := r.doc.GetStringWidth("Ballot Style: ")
	widthLabelPrecinct := r.doc.GetStringWidth("Precinct: ")
	widthLabelLanguage := r.doc.GetStringWidth("Language: ")

	lang, err := language.Parse(r.langCode)
	if err != nil {
		return err
	}

	langName := display.English.Languages().Name(lang)

	r.doc.SetFont(r.fontTinyBold(LangSecondary))
	widthValueElection := r.doc.GetStringWidth(electionHash[0:7])
	widthValueBallotStyle := r.doc.GetStringWidth(r.params.StyleId)
	widthValuePrecinct := r.doc.GetStringWidth(precinct.Name)
	widthValueLanguage := r.doc.GetStringWidth(langName)

	emptyWidth := r.frame.Size.X() -
		(widthLabelBallotStyle +
			widthLabelElection +
			widthLabelLanguage +
			widthLabelPrecinct +
			widthValueBallotStyle +
			widthValueElection +
			widthValueLanguage +
			widthValuePrecinct)

	spacing := emptyWidth / 3

	r.doc.SetFont(r.fontTiny(LangSecondary))
	r.doc.Cell(widthLabelElection, r.cfg.LnHeight.Tiny, "Election:")
	r.doc.SetFont(r.fontTinyBold(LangSecondary))
	r.doc.Cell(
		widthValueElection+spacing,
		r.cfg.LnHeight.Tiny,
		electionHash[0:7],
	)

	r.doc.SetFont(r.fontTiny(LangSecondary))
	r.doc.Cell(widthLabelBallotStyle, r.cfg.LnHeight.Tiny, "Ballot Style: ")
	r.doc.SetFont(r.fontTinyBold(LangSecondary))
	r.doc.Cell(
		widthValueBallotStyle+spacing,
		r.cfg.LnHeight.Tiny,
		r.params.StyleId,
	)

	r.doc.SetFont(r.fontTiny(LangSecondary))
	r.doc.Cell(widthLabelPrecinct, r.cfg.LnHeight.Tiny, "Precinct: ")
	r.doc.SetFont(r.fontTinyBold(LangSecondary))
	r.doc.Cell(widthValuePrecinct+spacing, r.cfg.LnHeight.Tiny, precinct.Name)

	r.doc.SetFont(r.fontTiny(LangSecondary))
	r.doc.Cell(widthLabelLanguage, r.cfg.LnHeight.Tiny, "Language: ")
	r.doc.SetFont(r.fontTinyBold(LangSecondary))
	r.doc.Cell(widthValueLanguage+spacing, r.cfg.LnHeight.Tiny, langName)

	return nil
}

func (r *Renderer) illustrationMarkBubble(origin Vec2) error {
	img := r.doc.GetImageInfo(imgNameMarkBubble)

	scale := r.cfg.InstructionImgWidth / img.Width()
	height := img.Height() * scale

	r.doc.ImageOptions(
		imgNameMarkBubble,
		origin.X(),
		origin.Y()-0.5*height,
		r.cfg.InstructionImgWidth,
		height,
		false,
		scribe.ImageOptions{},
		0,
		"",
	)

	return nil
}

func (r *Renderer) illustrationWriteIn(origin Vec2) error {
	img := r.doc.GetImageInfo(imgNameWriteIn)

	scale := r.cfg.InstructionImgWidth / img.Width()
	height := img.Height() * scale

	r.doc.ImageOptions(
		imgNameWriteIn,
		origin.X(),
		origin.Y()-0.5*height,
		r.cfg.InstructionImgWidth,
		height,
		false,
		scribe.ImageOptions{},
		0,
		"",
	)

	r.doc.SetXY(origin.X()+22, origin.Y()+5)
	r.pico(
		LangPrimary,
		r.cfg.InstructionImgWidth-22-20,
		"L",
		[]string{r.stringPrimary("hmpbWriteIn")},
	)

	return nil
}

func (r *Renderer) instructions() {
	width := r.frame.Size.X() - r.cfg.PaddingBox.X() - r.cfg.PaddingBox.X()

	widthWriteIn := r.cfg.InstructionWriteInWidthRatio * width
	widthWriteInText := widthWriteIn -
		(0.5 * r.cfg.PaddingBox.X()) -
		r.cfg.InstructionImgWidth -
		r.cfg.PaddingBox.X()

	widthVote := width - widthWriteIn
	widthVoteText := widthVote -
		(0.5 * r.cfg.PaddingBox.X()) -
		r.cfg.InstructionImgWidth -
		r.cfg.PaddingBox.X()

	r.doc.SetMeasurementFont(r.fontRegular(LangPrimary))
	linesInstructVotes := r.doc.TextSplit(
		r.stringPrimary("hmpbInstructionsToVoteText"),
		widthVoteText,
	)
	heightInstructions := r.cfg.PaddingBox.Y() +
		r.cfg.LnHeight.H2 +
		r.cfg.LnHeight.H4 +
		(float32(len(linesInstructVotes)) * r.cfg.LnHeight.Base) +
		r.cfg.PaddingBox.Y()

	linesInstructWriteIn := r.doc.TextSplit(
		r.stringPrimary("hmpbInstructionsWriteInText"),
		widthWriteInText,
	)
	heightInstructions = float32(math.Max(
		float64(heightInstructions),
		float64(r.cfg.PaddingBox.Y()+
			r.cfg.FontSize.H4+
			(float32(len(linesInstructWriteIn))*r.cfg.LnHeight.Base)+
			r.cfg.PaddingBox.Y()),
	))

	pos := Vec2{r.doc.GetX(), r.doc.GetY()}
	r.box(BoxParams{
		HeightHeader: heightInstructions,
		Pos:          pos,
		Width:        r.frame.Size.X(),
	})

	posInstructions := pos.Add(r.cfg.PaddingBox)
	r.doc.MoveTo(posInstructions.X(), posInstructions.Y())

	r.h2(LangPrimary, widthVoteText, "L", []string{
		r.stringPrimary("hmpbInstructions"),
	})
	r.h4(LangPrimary, widthVoteText, "L", []string{
		r.stringPrimary("hmpbInstructionsToVoteTitle"),
	})
	r.regular(LangPrimary, widthVoteText, "L", linesInstructVotes)

	x := posInstructions.X() + widthVoteText + r.cfg.PaddingBox.X()
	r.doc.SetLineWidth(1 * Px)
	r.illustrationMarkBubble(Vec2{
		x,
		pos.Y() + 0.5*heightInstructions,
	})

	x += r.cfg.InstructionImgWidth + r.cfg.PaddingBox.X()
	r.doc.MoveTo(x, posInstructions.Y())
	r.h4(LangPrimary, widthWriteInText, "L", []string{
		r.stringPrimary("hmpbInstructionsWriteInTitle"),
	})
	r.regular(LangPrimary, widthWriteInText, "L", linesInstructWriteIn)

	x += widthWriteInText + r.cfg.PaddingBox.X()
	y := pos.Y() + 0.5*heightInstructions
	r.doc.SetLineWidth(1 * Px)
	r.illustrationWriteIn(Vec2{x, y})

	r.doc.SetXY(pos.X(), pos.Y()+heightInstructions)
}

func (r *Renderer) pageAdd() {
	r.doc.AddPage()
	r.col = 0
	r.pageSide = PageSide(r.doc.PageNo() % 2)

	yFooter := r.yFooterFront
	if r.pageSide == PageSideFront {
		yFooter = r.yFooterBack
	}

	r.yContentMax = yFooter - r.cfg.Padding.Y()
	r.yContentMin = r.frame.Origin.Y()
	r.yEndCandidateContests = r.yContentMin

	r.timingMarks()
}

func (r *Renderer) PrecinctId() string {
	return r.params.PrecinctId
}

func (r *Renderer) stringPrimary(key string) string {
	return cmp.Or(
		r.election.Strings[r.langCode][key],
		StringCatalog[key],
	)
}

func (r *Renderer) stringSecondary(key string) string {
	if !r.langDual {
		return ""
	}

	return cmp.Or(
		r.election.Strings["en"][key],
		StringCatalog[key],
	)
}

func (r *Renderer) StyleId() string {
	return r.params.StyleId
}

func (r *Renderer) qrName(pageNum int) string {
	return "qr-p" + strconv.Itoa(pageNum)
}

func (r *Renderer) qrRegister(metadata MetadataEncoded) error {
	type result struct {
		err     error
		img     *bytes.Buffer
		pageNum uint8
	}

	qrs := make(chan *result)

	var wg sync.WaitGroup
	for i, page := range metadata.Pages {
		wg.Add(1)
		go func() {
			defer wg.Done()

			data := base64.StdEncoding.EncodeToString(page)
			qr, err := goqr.EncodeText(data, goqr.Quartile)
			if err != nil {
				qrs <- &result{err: err}
			}

			buf := make([]byte, 0, 4*1024)
			img := bytes.NewBuffer(buf)

			qrSizePx := r.cfg.QrSize / Px
			qrScale := float32(
				math.Ceil(float64(qrSizePx / float32(qr.GetSize()))),
			)
			err = cmp.Or(
				err,
				qr.WriteAsPNG(
					goqr.NewQrCodeImgConfig(int(qrScale), 0),
					img,
				),
			)
			if err != nil {
				qrs <- &result{err: err}
			}

			qrs <- &result{
				img:     img,
				pageNum: uint8(i + 1),
			}
		}()
	}

	done := make(chan struct{})
	go func() {
		for q := range qrs {
			if q.err != nil {
				r.doc.SetErrorf("unable to encode QR code: %w", q.err)
				continue
			}

			name := r.qrName(int(q.pageNum))
			qrImg := r.doc.RegisterImageOptionsReader(name, scribe.ImageOptions{
				ImageType: "png",
				ReadDpi:   true,
			}, q.img)
			qrImg.SetDpi(DpiImg)
		}
		done <- struct{}{}
	}()

	wg.Wait()
	close(qrs)
	<-done

	return r.doc.Error()
}

func (r *Renderer) qrRender() error {
	x, y := r.doc.GetXY()

	r.doc.ImageOptions(
		r.qrName(r.doc.PageNo()),
		x,
		y,
		r.cfg.QrSize,
		r.cfg.QrSize,
		false,
		scribe.ImageOptions{},
		0,
		"",
	)

	return nil
}

func (r *Renderer) seal(origin Vec2, containerHeight float32) error {
	const name = "seal"
	if !strings.HasPrefix(r.election.Seal, "data:") {
		return nil
	}

	idxImgData := strings.Index(r.election.Seal, ",")
	if idxImgData == -1 {
		return nil
	}

	imgData, err := base64.StdEncoding.DecodeString(
		r.election.Seal[idxImgData+1:],
	)
	if err != nil {
		return err
	}

	img := r.doc.RegisterImageOptionsReader(name, scribe.ImageOptions{
		ImageType: "png",
		ReadDpi:   true,
	}, bytes.NewBuffer(imgData))
	if err = r.doc.Error(); err != nil {
		return err
	}

	y := origin.Y()
	if containerHeight > r.cfg.SealSize {
		y += 0.5 * (containerHeight - r.cfg.SealSize)
	}

	img.SetDpi(300)
	r.doc.ImageOptions(
		name,
		origin.X(),
		y,
		r.cfg.SealSize,
		r.cfg.SealSize,
		false,
		scribe.ImageOptions{},
		0,
		"",
	)

	return nil
}

func (r *Renderer) BallotMode() string {
	if r.params.Official {
		return "official"
	}

	return "test"
}

func (r *Renderer) BallotType() elections.BallotType {
	return r.params.Type
}

func (r *Renderer) bold(
	lang Lang,
	width float32,
	align string,
	lines []string,
) {
	r.doc.SetFont(r.fontBold(lang))
	for _, line := range lines {
		r.textLine(
			textLineParams{
				line:     line,
				lnHeight: r.cfg.LnHeight.Base,
				align:    align,
				width:    width,
			},
		)
	}
}

func (r *Renderer) caption(
	lang Lang,
	width float32,
	align string,
	lines []string,
) {
	r.doc.SetFont(r.fontCaption(lang))
	for _, line := range lines {
		r.textLine(
			textLineParams{
				line:     line,
				lnHeight: r.cfg.LnHeight.Caption,
				align:    align,
				width:    width,
			},
		)
	}
}

func (r *Renderer) h1(lang Lang, width float32, align string, lines []string) {
	r.doc.SetFont(r.fontH1(lang))
	for _, line := range lines {
		r.textLine(
			textLineParams{
				line:     line,
				lnHeight: r.cfg.LnHeight.H1,
				align:    align,
				width:    width,
			},
		)
	}
}

func (r *Renderer) h2(lang Lang, width float32, align string, lines []string) {
	r.doc.SetFont(r.fontH2(lang))
	for _, line := range lines {
		r.textLine(
			textLineParams{
				line:     line,
				lnHeight: r.cfg.LnHeight.H2,
				align:    align,
				width:    width,
			},
		)
	}
}

func (r *Renderer) h3(lang Lang, width float32, align string, lines []string) {
	r.doc.SetFont(r.fontH3(lang))
	for _, line := range lines {
		r.textLine(
			textLineParams{
				line:     line,
				lnHeight: r.cfg.LnHeight.H3,
				align:    align,
				width:    width,
			},
		)
	}
}

func (r *Renderer) h4(lang Lang, width float32, align string, lines []string) {
	r.doc.SetFont(r.fontH4(lang))
	for _, line := range lines {
		r.textLine(
			textLineParams{
				line:     line,
				lnHeight: r.cfg.LnHeight.H4,
				align:    align,
				width:    width,
			},
		)
	}
}

func (r *Renderer) pico(
	lang Lang,
	width float32,
	align string,
	lines []string,
) {
	r.doc.SetFont(r.fontPico(lang))
	for _, line := range lines {
		r.textLine(
			textLineParams{
				line:     line,
				lnHeight: r.cfg.LnHeight.Pico,
				align:    align,
				width:    width,
			},
		)
	}
}

func (r *Renderer) regular(
	lang Lang,
	width float32,
	align string,
	lines []string,
) {
	r.doc.SetFont(r.fontRegular(lang))
	for _, line := range lines {
		r.textLine(
			textLineParams{
				line:     line,
				lnHeight: r.cfg.LnHeight.Base,
				align:    align,
				width:    width,
			},
		)
	}
}

func (r *Renderer) tiny(
	lang Lang,
	width float32,
	align string,
	lines []string,
) {
	r.doc.SetFont(r.fontTiny(lang))
	for _, line := range lines {
		r.textLine(
			textLineParams{
				line:     line,
				lnHeight: r.cfg.LnHeight.Tiny,
				align:    align,
				width:    width,
			},
		)
	}
}

type textLineParams struct {
	align string
	line  string

	lnHeight float32
	width    float32
}

func (r *Renderer) textLine(p textLineParams) {
	x := r.doc.GetX()

	r.doc.CellFormat(
		p.width,
		p.lnHeight,
		p.line,
		"", 1, p.align, false, 0, "",
	)

	r.doc.SetX(x)
}

func (r *Renderer) timingMarks() {
	r.doc.SetFillColor(0, 0, 0)

	x := r.cfg.PrintMargin.X()
	for range uint8(r.gridCellCount.X()) {
		r.timingMark(Vec2{x, r.gridP1.Y()})
		r.timingMark(Vec2{x, r.gridP2.Y()})
		x += r.cfg.Grid.MarkSize.X() + r.gridSpacing.X()
	}

	y := r.cfg.PrintMargin.Y()
	for range uint8(r.gridCellCount.Y()) {
		r.timingMark(Vec2{r.gridP1.X(), y})
		r.timingMark(Vec2{r.gridP2.X(), y})
		y += r.cfg.Grid.MarkSize.Y() + r.gridSpacing.Y()
	}
}

func (r *Renderer) timingMark(at Vec2) {
	r.doc.Rect(
		at.X(),
		at.Y(),
		r.cfg.Grid.MarkSize.X(),
		r.cfg.Grid.MarkSize.Y(),
		"F",
	)
}
