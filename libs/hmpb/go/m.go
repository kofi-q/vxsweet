package hmpb

type Vec2 [2]float32

func (self Vec2) Add(other Vec2) Vec2 {
	return Vec2{
		self[0] + other[0],
		self[1] + other[1],
	}
}

func (self Vec2) AddScalar(amt float32) Vec2 {
	return Vec2{
		self[0] + amt,
		self[1] + amt,
	}
}

func (self Vec2) Div(other Vec2) Vec2 {
	return Vec2{
		self[0] / other[0],
		self[1] / other[1],
	}
}

func (self Vec2) Mul(other Vec2) Vec2 {
	return Vec2{
		self[0] * other[0],
		self[1] * other[1],
	}
}

func (self Vec2) Spread() (float32, float32) {
	return self[0], self[1]
}

func (self Vec2) Sub(other Vec2) Vec2 {
	return Vec2{
		self[0] - other[0],
		self[1] - other[1],
	}
}

func (self *Vec2) X() float32 {
	return self[0]
}

func (self *Vec2) Y() float32 {
	return self[1]
}

type Rect struct {
	Origin Vec2
	Size   Vec2
}
