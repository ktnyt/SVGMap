SVGMap
======

A Google Maps API like implementation for SVG images.

### About

SVGMap is another implementation of a Google Maps API like library for SVG images. It is currently capable of creating a map with a specified image file, setting markers on the map (X, Y coordinate system), and creating information windows.


### Dependencies
This library depends on jQuery (2.1.3 used for development), Underscore.js, Bacon.js, and innersvg.js.


### Synopsis

```html
<!-- CSS -->
<link rel="stylesheet" type="text/css" href="style.css">

<!-- Script -->
<script type="text/javascript" src="jquery-2.1.3.min.js"></script>
<script type="text/javascript" src="underscore-min.js"></script>
<script type="text/javascript" src="Bacon.js"></script>
<script type="text/javascript" src="innersvg.js"></script>
<script type="text/javascript" src="SVGMap.js"></script>
<script type="text/javascript">
var sel = "#map";
var path = "image_uri";

/* Setup map with initial layer */
// Syntax: new G.SVGMap(selector, path, minimum_zoom, maximum_zoom)
var map = new G.SVGMap(sel, path, 0.125, 0.5);

/* Layers are loaded on the fly */
// Syntax: new G.SVGLayer(path, minmum_zoom, maximum_zoom, region_of_interest={}, initial_zoom=1)
var layer = map.addSVGLayer(new G.SVGLayer("other_image", 0.5, 2.0, {
    x: 0,
    y: 0,
    w: 2048,
    h: 1152
}));
var layer2 = map.addSVGLayer(new G.SVGLayer("another_image", 2.0, 4.0, {
    x: 0,
    y: 0,
    w: 1152,
    h: 1152
}, 2.0));


/* Markers */
// Syntax: new G.SVGMarker(coord_x, coord_y)
var marker = map.addSVGMarker(new G.SVGMarker(1500, 500));

/* Windows are pure SVG */
// Syntax: new G.SVGWindow(html_content, anchor_marker)
var html = '<div style="padding: 10px">hoge</div>';
var window = map.addSVGWindow(new G.SVGWindow(html), marker);
</script>
```
