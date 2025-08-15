package hmpb

var (
	CfgAllBubble = initCfgAllBubble()
)

func initCfgAllBubble() Cfg {
	ab := CfgBase
	ab.Padding = Vec2{CfgBase.Padding.X(), 3}
	ab.NoMetadata = true

	return ab
}
