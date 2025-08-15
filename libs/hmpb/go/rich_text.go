package hmpb

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"io"
	"math"
	"strconv"
	"strings"

	"github.com/kofi-q/scribe-go"
	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

type RichText struct {
	height float32
	lines  []HtmlLine
}

type HtmlLine interface {
	isHtmlLine()
}

type HtmlFontBold struct{}
type HtmlFontItalic struct{}
type HtmlFontStrike struct{}
type HtmlFontUnderline struct{}

type HtmlFontBoldEnd struct{}
type HtmlFontItalicEnd struct{}
type HtmlFontStrikeEnd struct{}
type HtmlFontUnderlineEnd struct{}

type HtmlImg struct {
	data   []byte
	width  float32
	height float32
}
type HtmlText struct {
	lines []string
	text  string
}

type HtmlLiEnd struct{}
type HtmlLiStart struct {
	number string
}

type HtmlListEnd struct{}
type HtmlListStart struct {
	indentSize float32
}

type HtmlNewline struct{}
type HtmlPara struct{}

type HtmlSvg struct {
	src scribe.SVGBasicType
}

type HtmlTable struct {
	colWidths  []float32
	rowHeights []float32
}

type HtmlTd struct{}
type HtmlTh struct{}
type HtmlThEnd struct{}
type HtmlTr struct{}
type HtmlTrEnd struct{}

func (t HtmlFontBold) isHtmlLine()         {}
func (t HtmlFontBoldEnd) isHtmlLine()      {}
func (t HtmlFontItalic) isHtmlLine()       {}
func (t HtmlFontItalicEnd) isHtmlLine()    {}
func (t HtmlFontStrike) isHtmlLine()       {}
func (t HtmlFontStrikeEnd) isHtmlLine()    {}
func (t HtmlFontUnderline) isHtmlLine()    {}
func (t HtmlFontUnderlineEnd) isHtmlLine() {}
func (t HtmlImg) isHtmlLine()              {}
func (t HtmlSvg) isHtmlLine()              {}
func (t HtmlLiEnd) isHtmlLine()            {}
func (t HtmlLiStart) isHtmlLine()          {}
func (t HtmlListEnd) isHtmlLine()          {}
func (t HtmlListStart) isHtmlLine()        {}
func (t HtmlPara) isHtmlLine()             {}
func (t HtmlTable) isHtmlLine()            {}
func (t HtmlTd) isHtmlLine()               {}
func (t HtmlTh) isHtmlLine()               {}
func (t HtmlThEnd) isHtmlLine()            {}
func (t HtmlTr) isHtmlLine()               {}
func (t HtmlTrEnd) isHtmlLine()            {}
func (t HtmlText) isHtmlLine()             {}
func (t HtmlNewline) isHtmlLine()          {}

type RichTextLinesParams struct {
	text  string
	width float32
}

func (r *Renderer) richTextLines(p RichTextLinesParams) (RichText, error) {
	rt := RichText{}

	inList := false
	inOrderedList := false
	ixListItem := 0
	indents := 0

	inTable := false
	tableColCount := 0
	tableColWidthMax := p.width
	tableColNum := 0
	var tableRowHeightMax float32 = 0.0
	var tableCur HtmlTable
	ixTableCur := -1

	reader := strings.NewReader(p.text)
	it := html.NewTokenizer(reader)
	isFirst := true

	scratch, err := r.doc.Scratch(p.width)
	if err != nil {
		return rt, err
	}

	scratch.SetFont(r.fontRegular(LangPrimary))

	for {
		typ := it.Next()
		switch typ {
		case html.CommentToken:
			continue
		case html.DoctypeToken:
			continue

		// [TODO] Merge StartTag and EndTag cases to co-locate open/close logic.
		case html.EndTagToken:
			tok := it.Token()
			switch tok.DataAtom {
			case atom.B, atom.Strong:
				scratch.StyleRemove(scribe.FontStyleB)
				rt.lines = append(rt.lines, HtmlFontBoldEnd{})

			case atom.Col:
				// [TODO]

			case atom.Colgroup:
				tableColWidthMax = (p.width / float32(tableColCount)) -
					2*r.cfg.PaddingTableCell.X()

				tableCur.colWidths = make([]float32, tableColCount)
				// [TODO]

			case atom.Em, atom.I:
				scratch.StyleRemove(scribe.FontStyleI)
				rt.lines = append(rt.lines, HtmlFontItalicEnd{})

			case atom.Li:
				scratch.Ln(r.cfg.LnHeight.Base)
				rt.lines = append(rt.lines, HtmlLiEnd{}, HtmlNewline{})

			case atom.P:
				if !inList && !inTable {
					scratch.Ln(r.cfg.LnHeight.Base)
					rt.lines = append(rt.lines, HtmlNewline{})
				}

			case atom.Strike, atom.S:
				scratch.StyleRemove(scribe.FontStyleS)
				rt.lines = append(rt.lines, HtmlFontStrikeEnd{})

			case atom.Table:
				inTable = false
				tableColCount = 0

				rt.height += scratch.Y()
				scratch.Reset(p.width - float32(indents)*r.cfg.IndentSize)

				rt.lines[ixTableCur] = tableCur
				ixTableCur = -1

			case atom.Tbody:
				// no-op

			case atom.Th:
				rt.lines = append(rt.lines, HtmlFontBoldEnd{}, HtmlThEnd{})
				fallthrough
			case atom.Td:
				tableRowHeightMax = float32(math.Max(
					float64(tableRowHeightMax),
					float64(scratch.Y()+r.cfg.LnHeight.Base),
				))

				tableCur.colWidths[tableColNum-1] = float32(math.Max(
					float64(tableCur.colWidths[tableColNum-1]),
					float64(scratch.WidthLongestLine()),
				))

			case atom.Tr:
				tableColNum = 0
				scratch.Ln(r.cfg.LnHeight.Base + r.cfg.PaddingTableCell.Y())
				rt.lines = append(rt.lines, HtmlTrEnd{})
				rt.height += tableRowHeightMax

			case atom.U:
				scratch.StyleRemove(scribe.FontStyleU)
				rt.lines = append(rt.lines, HtmlFontUnderlineEnd{})

			case atom.Ol:
				inOrderedList = false
				ixListItem = 0
				fallthrough
			case atom.Ul:
				inList = false
				indents -= 1

				rt.height += scratch.Y()
				scratch.Reset(p.width - float32(indents)*r.cfg.IndentSize)

				rt.lines = append(rt.lines, HtmlListEnd{})

			default:
				return rt, fmt.Errorf(
					"unexpected HTML tag end in rich text: %s",
					tok.Data,
				)
			}

		case html.ErrorToken:
			err = it.Err()
			if err == io.EOF {
				rt.height += scratch.Y() + r.cfg.LnHeight.Base
				return rt, nil
			}

			return rt, err

		case html.StartTagToken:
			tok := it.Token()
			switch tok.DataAtom {
			case atom.B, atom.Strong:
				scratch.StyleAdd(scribe.FontStyleB)
				rt.lines = append(rt.lines, HtmlFontBold{})

			case atom.Col:
				tableColCount += 1

			case atom.Colgroup:
				// no-op

			case atom.Em, atom.I:
				scratch.StyleAdd(scribe.FontStyleI)
				rt.lines = append(rt.lines, HtmlFontItalic{})

			case atom.Img, atom.Image:
				if !isFirst && !inList {
					scratch.Ln(r.cfg.ParagraphGap)
					rt.lines = append(rt.lines, HtmlPara{})
				}

				for _, attr := range tok.Attr {
					if attr.Key != "src" {
						continue
					}

					src := attr.Val
					if !strings.HasPrefix(src, "data:") {
						return rt, fmt.Errorf(
							"unexpected non-dataUrl image src",
						)
					}

					idxImgData := strings.Index(src, ",")
					if idxImgData == -1 {
						return rt, fmt.Errorf("malformed img data url")
					}

					imgData, err := base64.StdEncoding.DecodeString(
						src[idxImgData+1:],
					)
					if err != nil {
						return rt, fmt.Errorf(
							"unable to decode img dataUrl: %w",
							err,
						)
					}

					if bytes.HasPrefix(imgData, []byte{'<', 's', 'v', 'g'}) {
						svgInfo, err := scribe.SVGBasicParse(imgData)
						if err != nil {
							return rt, fmt.Errorf(
								"unable to parse SVG: %w",
								err,
							)
						}

						rt.lines = append(
							rt.lines,
							HtmlSvg{src: svgInfo},
							HtmlNewline{},
						)
						scratch.Ln(svgInfo.Ht)
						scratch.Ln(r.cfg.LnHeight.Base)

						continue
					}

					img, imgType, err := image.DecodeConfig(
						bytes.NewReader(imgData),
					)
					if err != nil {
						return rt, fmt.Errorf(
							"unable to decode img data: %w",
							err,
						)
					}

					fmt.Println("image:", imgType, img.Width, img.Height)
					rt.lines = append(rt.lines, HtmlImg{
						data:   imgData,
						width:  float32(img.Width) * Px,
						height: float32(img.Height) * Px,
					})
				}

			case atom.Li:
				ixListItem += 1
				number := ""
				if inOrderedList {
					number = strconv.FormatUint(uint64(ixListItem), 10) + "."
				}

				rt.lines = append(rt.lines, HtmlLiStart{number: number})

			case atom.P:
				if !isFirst && !inList && !inTable {
					scratch.Ln(r.cfg.ParagraphGap)
					rt.lines = append(rt.lines, HtmlPara{})
				}

			case atom.Strike, atom.S:
				scratch.StyleAdd(scribe.FontStyleS)
				rt.lines = append(rt.lines, HtmlFontStrike{})

			case atom.Table:
				if !isFirst && !inList {
					rt.lines = append(rt.lines, HtmlPara{})
					scratch.Ln(r.cfg.ParagraphGap)
				}

				// Placeholder - populated later in the EndTag handler.
				rt.lines = append(rt.lines, HtmlTable{})
				ixTableCur = len(rt.lines) - 1

				inTable = true
				rt.height += scratch.Y()
				scratch.Reset(p.width)

			case atom.Tbody:
				// no-op

			case atom.Th:
				rt.lines = append(rt.lines, HtmlFontBold{}, HtmlTh{})

				tableColNum += 1
				scratch.Reset(tableColWidthMax)

			case atom.Td:
				tableColNum += 1
				scratch.Reset(tableColWidthMax)

				rt.lines = append(rt.lines, HtmlTd{})

			case atom.Tr:
				rt.lines = append(rt.lines, HtmlTr{})
				scratch.Ln(r.cfg.PaddingTableCell.Y())

			case atom.U:
				scratch.StyleAdd(scribe.FontStyleU)
				rt.lines = append(rt.lines, HtmlFontUnderline{})

			case atom.Ol:
				inOrderedList = true
				ixListItem = 0
				fallthrough
			case atom.Ul:
				if !isFirst && !inList {
					scratch.Ln(r.cfg.ParagraphGap)
					rt.lines = append(rt.lines, HtmlPara{})
				}

				inList = true
				rt.height += scratch.Y()

				indents += 1
				indentSize := float32(indents) * r.cfg.IndentSize
				scratch.Reset(p.width - indentSize)
				rt.lines = append(
					rt.lines,
					HtmlListStart{indentSize: indentSize},
				)

			default:
				return rt, fmt.Errorf(
					"unexpected HTML tag start in rich text: %s",
					tok.Data,
				)
			}
		case html.TextToken:
			text := string(it.Text())
			lines := scratch.Text(r.cfg.LnHeight.Base, text)
			rt.lines = append(
				rt.lines,
				HtmlText{lines: lines, text: text},
			)

		default:
			return rt, fmt.Errorf(
				"unexpected HTML token in rich text: %s",
				typ,
			)
		}
		isFirst = false
	}
}
