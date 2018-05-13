"use strict";

function _classCallCheck(a, b) {
	if (!(a instanceof b)) throw new TypeError("Cannot call a class as a function")
}
var _createClass = function() {
		function a(a, b) {
			for (var c = 0; c < b.length; c++) {
				var d = b[c];
				d.enumerable = d.enumerable || !1, d.configurable = !0, "value" in d && (d.writable = !0), Object.defineProperty(a, d.key, d)
			}
		}
		return function(b, c, d) {
			return c && a(b.prototype, c), d && a(b, d), b
		}
	}(),
	CRC32_POLY = 3988292384,
	Crc32Engine = function() {
		function a() {
			_classCallCheck(this, a), this.crc32Table = new Uint32Array(256), a.initCrc32Table(this.crc32Table), this.rainbowTableHash = new Uint32Array(1e5), this.rainbowTableValue = new Uint32Array(1e5);
			for (var b = new Uint32Array(1e5), c = new Uint32Array(65537), d = 0; d < 1e5; d++) {
				var e = this.compute(d) >>> 0;
				b[d] = e, c[e >>> 16]++
			}
			var f = 0;
			this.shortHashBucketStarts = c.map(function(a) {
				return f += a
			});
			for (var g = 0; g < 1e5; g++) {
				var h = --this.shortHashBucketStarts[b[g] >>> 16];
				this.rainbowTableHash[h] = b[g], this.rainbowTableValue[h] = g
			}
		}
		return _createClass(a, null, [{
			key: "initCrc32Table",
			value: function(a) {
				for (var b = 0; b < 256; b++) {
					for (var c = b, d = 0; d < 8; d++) 1 & c ? c = c >>> 1 ^ CRC32_POLY : c >>>= 1;
					a[b] = c
				}
			}
		}]), _createClass(a, [{
			key: "compute",
			value: function(a) {
				var b = arguments.length > 1 && void 0 !== arguments[1] && arguments[1],
					c = 0,
					d = !0,
					e = !1,
					f = void 0;
				try {
					for (var g, h = a.toString()[Symbol.iterator](); !(d = (g = h.next()).done); d = !0) {
						var i = g.value;
						c = this.crc32Update(c, Number(i))
					}
				} catch (j) {
					e = !0, f = j
				} finally {
					try {
						!d && h["return"] && h["return"]()
					} finally {
						if (e) throw f
					}
				}
				if (b)
					for (var k = 0; k < 5; k++) c = this.crc32Update(c, 0);
				return c
			}
		}, {
			key: "crack",
			value: function(a) {
				for (var b = [], c = ~Number("0x" + a) >>> 0, d = 4294967295, e = 1; e < 10; e++)
					if (d = this.crc32Update(d, 48), e < 6) b = b.concat(this.lookup(c ^ d));
					else
						for (var f = Math.pow(10, e - 6), g = Math.pow(10, e - 5), h = f; h < g; h++) {
							var i = !0,
								j = !1,
								k = void 0;
							try {
								for (var l, m = this.lookup(c ^ d ^ this.compute(h, !0))[Symbol.iterator](); !(i = (l = m.next()).done); i = !0) {
									var n = l.value;
									b.push(1e5 * h + n)
								}
							} catch (o) {
								j = !0, k = o
							} finally {
								try {
									!i && m["return"] && m["return"]()
								} finally {
									if (j) throw k
								}
							}
						}
				return b
			}
		}, {
			key: "crc32Update",
			value: function(a, b) {
				return a >>> 8 ^ this.crc32Table[255 & (a ^ b)]
			}
		}, {
			key: "lookup",
			value: function(a) {
				a >>>= 0;
				for (var b = [], c = a >>> 16, d = this.shortHashBucketStarts[c]; d < this.shortHashBucketStarts[c + 1]; d++) this.rainbowTableHash[d] === a && b.push(this.rainbowTableValue[d]);
				return b
			}
		}]), a
	}();