var G = (function() {
    const SVGNS = "http://www.w3.org/2000/svg";
    const XMLNS = "http://www.w3.org/2000/xmlns";
    const XLINKNS = "http://www.w3.org/1999/xlink";
    const XHTMLNS = "http://www.w3.org/1999/xhtml";
    const SHAFTLEN = 128;

    const scrollEventType = "onwheel" in document.createElement("div") ? "wheel" : document.onmousewheel !== undefined ? "mousewheel" : "DOMMouseScroll";

    function create(type) {
        return document.createElement(type);
    }

    function createNS(namespace, type) {
        return document.createElementNS(namespace, type);
    }

    function setAttrNS(element, namespace, name, value) {
        element.setAttributeNS(namespace, name, value);
        return element;
    }

    function setAttrsNS(element, namespace, object) {
        for(var key in object) {
            setAttrNS(element, namespace, key, object[key]);
        }
        return element;
    }

    function preventDefault(event) {
        if(event.preventDefault) {
            event.preventDefault();
        } else {
            event.returnValue = false;
        }
        return event;
    }

    function originalEvent(event) {
        if(event.originalEvent) {
            return event.originalEvent;
        }
        return event;
    }

    function matrixTransform(p, m) {
        return {
            x: m.a * p.x + m.c * p.y + m.e,
            y: m.b * p.x + m.d * p.y + m.f
        };
    }

    function ROI(x, y, w, h, flag) {
        var p1, p2, p3, p4, x1, x2, y1, y2;
        if(flag !== undefined || flag) {
            w -= x;
            h -= y;
        }
        x1 = x;
        y1 = y;
        x2 = x + w;
        y2 = y + h;
        p1 = {x: x, y: y};
        p2 = {x: x + w, y: y};
        p3 = {x: x, y: y + h};
        p4 = {x: x + w, y: y + h};
        var self = {
            x: x,   y: y,   w: w,   h: h,
            x1: x1, x2: x2, y1: y1, y2: y2,
            p1: p1, p2: p2, p3: p3, p4: p4,
            contain: function(coord) {
                return (self.x1 <= coord.x && coord.x <= self.x2) && (self.y1 <= coord.y && coord.y <= self.y2);
            },
            overlap: function(roi) {
                return self.contain(roi.p1) || self.contain(roi.p2) || self.contain(roi.p3) || self.contain(roi.p4);
            }
        };
        return self;
    }

    function minimum(stream) {
        function min(a, b) {
            return a < b ? a : b;
        }
        return stream.scan(Infinity, min);
    }

    function maximum(stream) {
        function max(a, b) {
            return a > b ? a : b;
        }
        return stream.scan(-Infinity, max);
    }

    function elementStream(element, handler) {
        return element.asEventStream(handler).map(preventDefault).map(originalEvent);
    }

    function toggleStream(trueStream, falseStream, init) {
        return trueStream.map(true).merge(falseStream.map(false)).toProperty(init);
    }

    function click(element) {
        return elementStream(element, "click");
    }

    function point(element) {
        // TODO: implement
    }

    function mouseEnter(element) {
        return elementStream(element, "mouseenter");
    }

    function mouseLeave(element) {
        return elementStream(element, "mouseleave");
    }

    function mouseUp(element) {
        return elementStream(element, "mouseup");
    }

    function mouseDown(element) {
        return elementStream(element, "mousedown");
    }

    function mouseMove(element) {
        return elementStream(element, "mousemove");
    }

    function mouseState(downStream, upStream) {
        return toggleStream(downStream, upStream, false);
    }

    function mouseOverState(enterStream, leaveStream) {
        return toggleStream(enterStream, leaveStream, false);
    }

    function mouseCoord(mouseStream) {
        function coord(event) {
            return {
                x: event.clientX,
                y: event.clientY
            };
        }
        return mouseStream.map(coord);
    }

    function mouseDelta(coordStream) {
        function diff(a, b) {
            return {
                x: b.x - a.x,
                y: b.y - a.y
            };
        }
        return coordStream.diff({x: 0, y: 0}, diff);
    }

    function wheel(element) {
        return elementStream(element, scrollEventType);
    }

    function wheelDelta(wheelStream) {
        function reshape(event) {
            var delta = 1;
            if(event.deltaY) {
                delta = Math.pow(1.2, event.deltaY / -360);
            } else if (event.wheelDelta) {
                delta = Math.pow(1.2, event.wheelDelta / -360);
            } else {
                delta = Math.pow(1.2, event.detail / -9);
            }
            var coord = {x: event.clientX, y: event.clientY};
            return {
                delta: delta,
                coord: coord
            };
        }
        return wheelStream.map(reshape);
    }

    function scrolling(wheelStream) {
        return wheelStream.map(true).merge(wheelStream.debounce(200).map(false)).skipDuplicates().toProperty(false);
    }

    function realEvent(eventStream, ctmStream) {
        return Bacon.combineTemplate({
            event: eventStream,
            ctm: ctmStream
        }).sampledBy(eventStream).map(function(object) {
            var event = object.event;
            const ctm = object.ctm;
            const real = matrixTransform({x: event.clientX, y: event.clientY}, ctm);
            event.realX = real.x;
            event.realY = real.y;
            return event;
        });
    };

    function dragCTM(mouseDeltaStream, ctmStream) {
        return Bacon.combineTemplate({
            delta: mouseDeltaStream,
            ctm: ctmStream
        }).sampledBy(mouseDeltaStream).map(function(object) {
            const delta = object.delta;
            const ctm = object.ctm;
            const z = ctm.a;
            const dx = delta.x / z;
            const dy = delta.y / z;
            const t = ctm.translate(dx, dy);
            return t;
        });
    }

    function scaleCTM(wheelDeltaStream, ctmStream, minStream, maxStream) {
        return Bacon.combineTemplate({
            wheel: wheelDeltaStream,
            ctm: ctmStream,
            min: minStream,
            max: maxStream
        }).sampledBy(wheelDeltaStream).map(function(object) {
            const delta = object.wheel.delta;
            const coord = object.wheel.coord;
            const ctm = object.ctm;
            const min = object.min;
            const max = object.max;
            const z = (function(s, delta) {
                const z = s * delta;
                if(min !== undefined && min !== 0 && z < min) {
                    return min;
                } else if(max !== undefined && max !== 0 && max < z) {
                    return max;
                } else {
                    return z;
                }
            })(ctm.a, delta, min, max);
            const p = matrixTransform(coord, ctm.inverse());
            const e = ctm.multiply(ctm.inverse());
            const t = e.translate(coord.x, coord.y).scale(z).translate(-p.x, -p.y);
            return t;
        });
    }

    function uiScaleValue(ctmStream, minStream, maxStream) {
        return Bacon.combineTemplate({
            scale: ctmStream.map(function(ctm) {
                return ctm.a;
            }).skipDuplicates(_.isEqual),
            min: minStream,
            max: maxStream
        }).map(function(object) {
            const scale = object.scale;
            const min = object.min;
            const max = object.max;
            return Math.log(scale / min) / Math.log(max / min) * 128;
        });
    }

    function coordValue(coordStream, ctmStream) {
        return Bacon.combineTemplate({
            coord: coordStream,
            ctm: ctmStream
        }).map(function(object) {
            const coord = object.coord;
            const ctm = object.ctm;
            return matrixTransform(coord, ctm.inverse());
        });
    }

    function scaleValue(ctmStream) {
        return ctmStream.map(function(ctm) {
            return ctm.a;
        });
    }

    function screenValue(element, ctmStream) {
        return ctmStream.map(function(ctm) {
            var p1 = matrixTransform({x: 0, y: 0}, ctm.inverse());
            var p2 = matrixTransform({x: $(element).width(), y: $(element).height()}, ctm.inverse());
            return new ROI(p1.x, p1.y, p2.x, p2.y, true);
        });
    }

    function stateStream(coordStream, scaleStream, screenStream) {
        return Bacon.combineTemplate({
            coord: coordStream,
            scale: scaleStream,
            screen: screenStream
        });
    }

    function updateStream(layerStream, stateStream) {
        return Bacon.combineTemplate({
            layer: layerStream,
            state: stateStream
        }).map(function(object) {
            const layer = object.layer;
            const state = object.state;
            return {
                buffer: layer.filter(function(element, index, array) {
                    return element.inScale(state.scale) && element.inScreen(state.screen);
                }),
                remove: layer.filter(function(element, index, array) {
                    return !(element.inScale(state.scale) && element.inScreen(state.screen));
                })
            };
        }).skipDuplicates(_.isEqual);
    }

    function ctm2string(ctm) {
        return "matrix(" + [ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f].reduce(function(prev, curr) {
            return prev + "," + curr;
        }) + ")";
    };

    function ctmString(streams) {
        return Bacon.mergeAll(streams).map(ctm2string);
    }

    function loadSVG(path, roi) {
        var xhr = new XMLHttpRequest;
        xhr.open("get", path, false);
        xhr.send(null);

        if(xhr.status !== 200) {
            return null;
        }

        var svg = $(document.importNode(xhr.responseXML.documentElement, true));
        var g = $(createNS(SVGNS, "g")).append(svg.children());

        if(roi !== undefined) {
            g.attr({
                "x": roi.x,
                "y": roi.y,
                "width": roi.w,
                "height": roi.h
            });
        } else {
            $(create("img")).attr({
                src: path,
                hidden: ""
            }).appendTo($("body")).load(function() {
                g.attr({
                    width: $(this).width(),
                    height: $(this).height()
                });
                $(this).remove();
            });
        }

        return g;
    }

    function loadIMG(path, roi, callback) {
        var image = $(setAttrNS(createNS(SVGNS, "image"), XLINKNS, "xlink:href", path));
        if(roi !== undefined) {
            image.attr({
                "x": roi.x,
                "y": roi.y,
                "width": roi.w,
                "height": roi.h
            });
            if(!!callback) {
                callback(roi);
            }
        } else {
            $(create("img")).attr({
                src: path,
                hidden: ""
            }).appendTo($("body")).load(function() {
                image.attr({
                    width: $(this).width(),
                    height: $(this).height()
                });
                if(!!callback) {
                    callback({
                        x: 0,
                        y: 0,
                        w: $(this).width(),
                        h: $(this).height()
                    });
                }
                $(this).remove();
            });
        }
        return image;
    }

    function load(path, roi, callback) {
        if(false) {
            return loadSVG(path, roi, callback);
        } else {
            return loadIMG(path, roi, callback);
        }
    }

    return {
        SVGMap: function(selector, path, min, max, roi) {
            var self = {};
            var element = $(selector);
            var container = $(create("div")).css({
                position: "relative",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%"
            }).appendTo(element);
            var uiContainer = $(create("div")).css({
                position: "relative",
                top: "-100%",
                left: 0,
                width: "100%",
                height: "100%",
                "pointer-events": "none"
            }).appendTo(element);

            var svg = $(createNS(SVGNS, "svg")).appendTo(container.css("overflow", "hidden")).attr({
                width: "100%",
                height: "100%",
                "xmlns": XMLNS,
                "xmlns:svg": SVGNS,
                "xmlns:xlink": XLINKNS
            })[0];

            var uiSvg = $(createNS(SVGNS, "svg")).appendTo(uiContainer.css("overflow", "hidden")).attr({
                width: "100%",
                height: "100%",
                "xmlns": XMLNS,
                "xmlns:svg": SVGNS,
                "xmlns:xlink": XLINKNS
            })[0];

            var viewport = $(createNS(SVGNS, "g")).attr("id", "viewport").appendTo(svg)[0];

            var minStream = new Bacon.Bus();
            var maxStream = new Bacon.Bus();
            var ctmStream = new Bacon.Bus();
            var layerStream = new Bacon.Bus();

            var mouseDownStream = mouseDown(container);
            var mouseUpStream = mouseUp(container);
            var mouseMoveStream = mouseMove(container);
            var wheelStream = wheel(container);

            var layers = [];
            var windows = [];

            mouseState(mouseDown(container), mouseUp(container)).onValue(function() {});

            var drag = dragCTM(mouseDelta(mouseCoord(mouseMove(container))).filter(mouseState(mouseDown(container), mouseUp(container))), ctmStream);
            var scale = scaleCTM(wheelDelta(wheel(container)), ctmStream, minimum(minStream), maximum(maxStream));
            var scroll = scrolling(wheel(container));

            var transform = Bacon.mergeAll(scale, drag);
            var unsub = transform.onValue(function(t) {
                ctmStream.push(t);
            });
            var coordVal = coordValue(mouseCoord(mouseMove(container)), ctmStream);
            var scaleVal = scaleValue(ctmStream);
            var screenVal = screenValue(container, ctmStream).skipDuplicates();

            var state = stateStream(coordVal, scaleVal, screenVal);
            var update = updateStream(layerStream, state);

            var markerLayer = new G.SVGLayer().appendTo($(viewport)).show();
            var windowLayer = new G.SVGLayer().appendTo($(viewport)).show();

            var root = (self.addSVGLayer = function(layer) {
                if(layer.min !== undefined) minStream.push(layer.min);
                if(layer.max !== undefined) maxStream.push(layer.max);
                layer.appendTo($(viewport));
                layers.push(layer);
                layerStream.push(layers);
                markerLayer.appendTo($(viewport));
                windowLayer.appendTo($(viewport));
                return layer;
            })(G.SVGLayer(path, min, max, roi).optimize(ctmStream, container.width(), container.height()));

            self.addSVGMarker = function(marker, layer) {
                if(layer === undefined) {
                    layer = markerLayer;
                }

                layer.addSVGMarker(marker);
                marker.registerScale(scaleVal.toProperty());
                ctmStream.push(viewport.getCTM());

                return marker;
            };

            self.addSVGWindow = function(window, target) {
                window.registerScale(scaleVal.toProperty());
                window.bindMarker(target);
                if(target.type === "SVGMarker") {
                    windowLayer.addSVGWindow(window);
                }
                ctmStream.push(viewport.getCTM());
                return window;
            };

            Bacon.combineTemplate({
                update: update,
                scroll: scroll
            }).onValue(function(object) {
                const update = object.update;
                const scroll = object.scroll;
                if(!scroll) {
                    update.remove.forEach(function(element) {
                        element.hide().remove();
                    });
                }
            });

            update.onValue(function(object) {
                object.remove.forEach(function(layer) {
                    layer.hide();
                });
                object.buffer.forEach(function(layer) {
                    layer.show().append();
                });
            });

            root.show().append();

            ctmString(ctmStream).assign($(viewport), "attr", "transform");

            var init = min !== 0 && min !== Infinity && min != -Infinity ? min : 1;
            ctmStream.push(viewport.getCTM().scale(init));

            self.addEventListener = function(type, callback) {
                realEvent(elementStream(container, type), ctmStream).onValue(function(event) {
                    callback(event);
                });
                ctmStream.push(viewport.getCTM());
                return self;
            };

            var defs = $(createNS(SVGNS, "defs")).appendTo(svg);

            var windowFilters =
                    "<feGaussianBlur result=\"blurOut\" in=\"SourceAlpha\" stdDeviation=\"5\" />\n" +
                    "<feMerge>" +
                    "  <feMergeNode in=\"blurOut\" />" +
                    "  <feMergeNode in=\"SourceGraphic\" />" +
                    "</feMerge>";


            var windowFilter = $(createNS(SVGNS, "filter")).attr({
                id: "SVGWindowFilter",
                x: "-50%",
                y: "-50%",
                width: "200%",
                height: "200%"
            }).appendTo(defs).html(windowFilters);

            var uiDefs = $(createNS(SVGNS, "defs")).appendTo(uiSvg);

            var uiFilters = 
                    "<feOffset result=\"offOut\" in=\"SourceAlpha\" dx=\"0\" dy=\"1\" />" +
                    "<feGaussianBlur result=\"blurOut\" in=\"offOut\" stdDeviation=\"1\" />" +
                    "<feMerge>" +
                    "  <feMergeNode in=\"blurOut\"></feMergeNode>" +
                    "  <feMergeNode in=\"SourceGraphic\"></feMergeNode>" +
                    "</feMerge>";

            var uiFilter = $(createNS(SVGNS, "filter")).attr({
                id: "SVGUiFilter",
                x: "-50%",
                y: "-50%",
                width: "200%",
                height: "200%"
            }).appendTo(uiDefs).html(uiFilters);

            self.type = "SVGMap";

            var ui = $(createNS(SVGNS, "g")).attr("transform", "translate(20, 20)").css("pointer-events", "visible").appendTo(uiSvg);
            var shaft = $(createNS(SVGNS, "rect")).attr({
                x: 6,
                y: 8,
                width: 4,
                height: SHAFTLEN + 16 + 8,
                filter: "url(#SVGUiFilter)"
            }).css({
                fill: "rgb(255, 255, 255)",
                stroke: "rgb(132, 132, 132)",
                "stroke-width": 1
            }).appendTo(ui);
            var plus = $(createNS(SVGNS, "rect")).attr({
                x: 0,
                y: 0,
                width: 16,
                height: 16,
                rx: 2,
                ry: 2,
                cursor: "pointer",
                filter: "url(#SVGUiFilter)"
            }).css({
                fill: "rgb(255, 255, 255)",
                stroke: "rgb(132, 132, 132)",
                cursor: "pointer",
                "stroke-width": 1
            }).appendTo(ui);
            $(createNS(SVGNS, "line")).attr({
                x1: 4,
                y1: 8,
                x2: 12,
                y2: 8
            }).css({
                fill: "rgb(255, 255, 255)",
                stroke: "rgb(132, 132, 132)",
                cursor: "pointer",
                "stroke-width": 1
            }).appendTo(ui);
            $(createNS(SVGNS, "line")).attr({
                x1: 8,
                y1: 4,
                x2: 8,
                y2: 12
            }).css({
                fill: "rgb(255, 255, 255)",
                stroke: "rgb(132, 132, 132)",
                cursor: "pointer",
                "stroke-width": 1
            }).appendTo(ui);
            var minus = $(createNS(SVGNS, "rect")).attr({
                x: 0,
                y: SHAFTLEN + 24 + 4,
                width: 16,
                height: 16,
                rx: 2,
                ry: 2,
                cursor: "pointer",
                filter: "url(#SVGUiFilter)"
            }).css({
                fill: "rgb(255, 255, 255)",
                stroke: "rgb(132, 132, 132)",
                cursor: "pointer",
                "stroke-width": 1
            }).appendTo(ui);
            $(createNS(SVGNS, "line")).attr({
                x1: 4,
                y1: SHAFTLEN + 32 + 4,
                x2: 12,
                y2: SHAFTLEN + 32 + 4
            }).css({
                fill: "rgb(255, 255, 255)",
                stroke: "rgb(132, 132, 132)",
                cursor: "pointer",
                "stroke-width": 1
            }).appendTo(ui);
            var slider = $(createNS(SVGNS, "rect")).attr({
                x: 0,
                y: 100,
                width: 16,
                height: 8,
                rx: 2,
                ry: 2,
                cursor: "pointer",
                filter: "url(#SVGUiFilter)"
            }).css({
                fill: "rgb(255, 255, 255)",
                stroke: "rgb(132, 132, 132)",
                cursor: "pointer",
                "stroke-width": 1
            }).appendTo(ui);

            var uiScaleStream = uiScaleValue(ctmStream, minimum(minStream), maximum(maxStream));
            var uiDragStream = Bacon.combineTemplate({
                y: mouseCoord(mouseMove(ui)).filter(mouseState(mouseDown(ui), mouseUp(ui)).and(mouseOverState(mouseEnter(ui), mouseLeave(ui)))).map(function(coord) {
                    return coord.y;
                }),
                min: minimum(minStream),
                max: maximum(maxStream)
            });

            var plusClick = click(plus).map(function() {return slider.attr("y") - 16 - 2;});
            var minusClick = click(minus).map(function() {return slider.attr("y") - 16 - 2;});

            uiScaleStream.onValue(function(y) {
                slider.attr("y", (SHAFTLEN - y) + 16 + 2);
            });
            uiDragStream.onValue(function(object) {
                const y = object.y - 32 - 8;
                const min = object.min;
                const max = object.max;
                if(0 <= y && y <= SHAFTLEN) {
                    const coord = {
                        x: container.width() / 2,
                        y: container.height() / 2
                    };
                    const scale = Math.pow(Math.E, ((SHAFTLEN  - y) * Math.log(max / min) / 128)) * min;
                    const ctm = viewport.getCTM();
                    const p = matrixTransform(coord, ctm.inverse());
                    const e = ctm.multiply(ctm.inverse());
                    const t = e.translate(coord.x, coord.y).scale(scale).translate(-p.x, -p.y);
                    ctmStream.push(t);
                }
            });
            plusClick.onValue(function(w) {
                const y = w - 16;
                if(0 <= y && y <= SHAFTLEN) {
                    const coord = {
                        x: container.width() / 2,
                        y: container.height() / 2
                    };
                    const scale = Math.pow(Math.E, ((SHAFTLEN  - y) * Math.log(max / min) / 128)) * min;
                    const ctm = viewport.getCTM();
                    const p = matrixTransform(coord, ctm.inverse());
                    const e = ctm.multiply(ctm.inverse());
                    const t = e.translate(coord.x, coord.y).scale(scale).translate(-p.x, -p.y);
                    ctmStream.push(t);
                }
            });
            minusClick.onValue(function(w) {
                const y = w + 16;
                if(0 <= y && y <= SHAFTLEN) {
                    const coord = {
                        x: container.width() / 2,
                        y: container.height() / 2
                    };
                    const scale = Math.pow(Math.E, ((SHAFTLEN  - y) * Math.log(max / min) / 128)) * min;
                    const ctm = viewport.getCTM();
                    const p = matrixTransform(coord, ctm.inverse());
                    const e = ctm.multiply(ctm.inverse());
                    const t = e.translate(coord.x, coord.y).scale(scale).translate(-p.x, -p.y);
                    ctmStream.push(t);
                }
            });

            minStream.push(Infinity);
            maxStream.push(-Infinity);
            minStream.push(min);
            maxStream.push(max);
            ctmStream.push(viewport.getCTM());

            return self;
        },

        SVGLayer: function(path, min, max, roi, zoom) {
            var self = {};
            var element = $(createNS(SVGNS, "g"));
            var image;
            var appended = false;

            if(zoom === undefined || !(zoom > 0)) {
                zoom = 1;
            }

            element.attr("transform", "scale(" + zoom + ")");

            if(roi !== undefined) {
                roi = new ROI(roi.x, roi.y, roi.w, roi.h);
            }
            self.appendTo = function(parent) {
                element.remove().appendTo(parent);
                return self;
            };
            self.append = function() {
                if(!appended) {
                    if(!!path) {
                        image = load(path, roi);
                        element.prepend(image);
                        appended = true;
                    }
                }
                return self;
            };
            self.remove = function() {
                if(appended) {
                    if(!!path) {
                        image.remove();
                        appended = false;
                    }
                }
                return self;
            };
            self.hide = function() {
                element.attr("visibility", "hidden");
                return self;
            };
            self.show = function() {
                element.removeAttr("visibility");
                return self;
            };
            self.inScale = function(scale) {
                return (min <= scale && scale <= max);
            };
            self.inCoord = function(coord) {
                return roi === undefined || roi.contain(coord);
            };
            self.inScreen = function(screen) {
                return roi === undefined || screen.overlap(roi) || roi.overlap(screen);
            };
            self.addSVGMarker = function(marker) {
                marker.bindLayer(self);
                return marker.appendTo(element);
            };
            self.addSVGWindow = function(window) {
                return window.appendTo(element);
            };
            self.disablePointer = function(window) {
                element.css("pointer-events", "none");
                return self;
            };
            self.optimize = function(ctmStream, width, height) {
                image = load(path, roi, function(coords) {
                    const scaleX = width / coords.w;
                    const scaleY = height / coords.h;
                    const scale = scaleX < scaleY ? scaleX : scaleY;
                    const deltaX = (width - coords.w * scale) / 2;
                    const deltaY = (height - coords.h * scale) / 2;
                    const viewport = $("#viewport")[0];
                    const ctm = viewport.getCTM();
                    const e = ctm.multiply(ctm.inverse());
                    const s = e.scale(scale);
                    const t = e.translate(deltaX / scale, deltaY / scale);
                    const m = s.multiply(t);
                    ctmStream.push(m);
                });
                return self;
            };
            self.min = min;
            self.max = max;
            self.hide();
            self.type = "SVGLayer";
            return self;
        },

        SVGMarker: function(x, y) {
            var w = 32;
            var h = 39;
            var dx = -7;
            var dy = -35;
            var element = loadIMG("pin.png", {x: x, y: y, w: w, h: h}); // TODO: Parameterize
            var self = {};
            var layer;

            self.appendTo = function(parent) {
                parent.append(element);
            };
            self.remove = function() {
                element.remove();
            };
            self.bindLayer = function(bound) {
                layer = bound;
            };
            self.registerScale = function(scaleStream) {
                scaleStream.onValue(function(scale) {
                    if(scale !== 0) {
                        element.attr({
                            x: x + (dx / scale),
                            y: y + (dy / scale),
                            width: w / scale,
                            height: h / scale
                        });
                        self.point = {
                            x: x,
                            y: y
                        };
                    }
                });
                return self;
            };
            self.addSVGWindow = function(window) {
                window.bindMarker(self);
                layer.addSVGWindow(window);
            };
            self.addEventListener = function(type, callback) {
                element.bind(type, callback);
                return self;
            };
            self.diff = {
                dx: dx,
                dy: dy
            };
            self.type = "SVGMarker";
            return self;
        },

        SVGWindow: function(html) {
            var self = {};
            var div = $(create("div")).html(html).attr("hidden", "").appendTo("body");
            var g = $(createNS(SVGNS, "g")).appendTo($("#viewport"));
            var t = $(createNS(SVGNS, "g")).appendTo(g);
            var w = div.width();
            var h = div.height();
            var x = 0;
            var y = 0;
            var maxW = 0.6;

            div.width(w > $(window).width() * maxW ? $(window).width() * maxW : w); // TODO: Parameterize
            w = div.width();
            h = div.height();

            var l = 30; // TODO: Parameterize
            var p1 = ((w - l) / 2) + " " + (h - 1);
            var p2 = ((w + l) / 2) + " " + (h - 1);
            var p3 = (w / 2) + " " + (h + l);

            var wg = $(createNS(SVGNS, "g")).attr({
                filter: "url(#SVGWindowFilter)"
            }).appendTo(t);

            var poly = $(createNS(SVGNS, "polygon")).attr({
                points: p1 + " " + p2 + " " + p3,
                fill: "white",
                style: "fill: white;"
            }).appendTo(wg);

            var rect = $(createNS(SVGNS, "rect")).attr({
                width: w,
                height: h,
                rx: 5,
                ry: 5,
                fill: "white",
                style: "fill: white;"
            }).appendTo(wg);

            var dx = -w / 2;
            var dy = -h - l;

            var obj = $(createNS(SVGNS, "foreignObject")).append(html).appendTo(t).attr({
                width: w,
                height: h
            });
            div.remove();

            var open = false;

            self.appendTo = function(parent) {
                parent.append(g);
            };
            self.show = function(anchor) {
                if(anchor !== undefined) {
                    if(anchor.type !== undefined && anchor.type === "SVGMarker") {
                        self.show(anchor.point);
                    } else {
                        x = anchor.x;
                        y = anchor.y;
                    }
                }
                g.attr({
                    transform: "translate(" + x + "," + y +")"
                });
                g.removeAttr("visibility");
                return self;
            };
            self.hide = function() {
                g.attr("visibility", "hidden");
                return self;
            };
            self.bindMarker = function(marker) {
                if(marker === undefined) {
                    dx = -w / 2;
                    dy = -h;
                    return;
                }
                dy += marker.diff.dy;
                marker.addEventListener("click", function(event) {
                    if(!open) {
                        self.show(marker);
                        open = true;
                    } else {
                        self.hide();
                        open = false;
                    }
                });
            };
            self.registerScale = function(scaleStream) {
                scaleStream.onValue(function(scale) {
                    if(scale !== 0) {
                        g.attr({
                            transform: "translate(" + x + "," + y +")"
                        });
                        t.attr({
                            transform: "scale(" + 1 / scale + ") translate(" + dx + "," + dy + ")"
                        });
                    }
                });
                return self;
            };
            self.appendTo = function(parent) {
                parent.append(g);
            };
            self.hide();
            self.type = "SVGWindow";
            return self;
        },
        SVGController: function(ctmStream) {
            var self = {};
        }
    };
})();
