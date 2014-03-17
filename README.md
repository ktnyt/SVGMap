SVGMap
======

A Google Maps API like implementation for SVG images.

### About

SVGMap is another implementation of a Google Maps API like library for SVG images. It is currently capable of creating a map with a specified image file, setting markers on the map (X, Y coordinate system), and creating information windows.

### Usage

Using SVGMap is simple.

```html
<!-- CSS -->
<link rel="stylesheet" type="text/css" href="style.css">

<!-- Script -->
<script type="text/javascript" src="../SVGMap.js"></script>
<script type="text/javascript">
var map = new SVGMap(selector, filepath);
var marker = new SVGMap.Marker( {
    map: map,
    position: { x: x, y: y },
    icon: 'pin.png',
    offset: { x: 7, y: 35 },
    anchorPoint: { x: 0, y: 39 }
} );

var infoWindow = new SVGMap.InfoWindow( {
    position: { x: x, y: y },
    content: 'Hello, map!'
} );

marker.container.onclick = function() {
    infoWindow.open( map, marker );
};
</script>
```

You're done.

See the demo code for further examples.
