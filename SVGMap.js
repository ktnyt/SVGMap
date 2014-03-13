function is( obj, ofType ) {
    var isType = Object.prototype.toString.call( obj ).slice( 8, -1 );
    return obj !== undefined && obj !== null && isType === ofType;
};

function dumpMatrix( matrix ) {
    return "[ " + matrix.a + ", " + matrix.c + ", " + matrix.e + "\n  " + matrix.b + ", " + matrix.d + ", " + matrix.f + "\n  0, 0, 1 ]";
}

var SVGMap = function( selector, filepath ) {
    var SVGNS = "http://www.w3.org/2000/svg";
    var XMLNS = "http://www.w3.org/2000/xmlns";
    var XLINKNS = "http://www.w3.org/1999/xlink";
    var self = this, panning = false, container, svg;
    var clientWidth, clientHeight, svgWidth, svgHeight;

    // Get container and set SVG content
    if( !selector ) {
        console.error( 'Fatal: Selector not specified' );
        return;
    } else {
        container = document.querySelector( selector );

        if( !container ) {
            console.error( 'Fatal: Selected element not found.' );
            return;
        }

        container.style.overflow = 'hidden';

        clientWidth = container.clientWidth;
        clientHeight = container.clientHeight;

        if( filepath.match( /\.svg$/, "i" ) ) {
            var xhr = new XMLHttpRequest;
            xhr.open( 'get', filepath, false );
            xhr.send( null );

            if( xhr.status !== 200 ) {
                console.error( 'Fatal: Error in XHR, status: ' + xhr.status );
                return;
            }

            svg = document.importNode( xhr.responseXML.documentElement, true );
            container.appendChild( svg );
        } else if( filepath.match( /\.png$|\.jpe?g$|\./, "i" ) ) {
            svg = document.createElementNS( SVGNS, 'svg' );
            svg.setAttribute( 'xmlns', XMLNS );
            svg.setAttribute( 'xmlns:svg', SVGNS );
            svg.setAttribute( 'xmlns:xlink', XLINKNS );
            svg.setAttributeNS( null, 'width', 8192 );
            svg.setAttributeNS( null, 'height', 8192 );
            var g = document.createElementNS( SVGNS, 'g' );
            var i = document.createElementNS( SVGNS, 'image' );
            i.setAttributeNS( XLINKNS, 'xlink:href', filepath );
            i.setAttributeNS( null, 'x', 0 );
            i.setAttributeNS( null, 'y', 0 );
            i.setAttributeNS( null, 'width', 8192 );
            i.setAttributeNS( null, 'height', 8192 );
            g.appendChild( i );
            svg.appendChild( g );
            container.appendChild( svg );
        } else {
            console.error( 'Fatal: specified file is not valid.' );
            return;
        }
    }

    // Get SVG Viewport
    var svgViewBox, viewport;
    if( !svg.__viewportElement ) {
        svg.__viewportElement = svg.getElementById( 'viewport' );
        if( !svg.__viewportElement ) {
            svg.__viewportElement = svg.getElementsByTagName( 'g' )[0];
        }
        if( !svg.__viewportElement ) {
            console.error( 'Fatal: No g element in SVG to use for viewport.' );
            return;
        }
        svgViewBox = svg.getAttribute( 'viewBox' );
        if( svgViewBox ) {
            svg.__viewportELement.setAttribute( 'viewBox', svgViewBox );
            svg.removeAttribute( 'viewBox' );
        }
    }
    viewport = svg.__viewportElement;

    svgWidth = svg.clientWidth;
    svgHeight = svg.clientHeight;

    // Private Methods
    function checkOverflow() {
        /**
         * TODO
         * Make sure to check the svg does not overflow
         */
        var o = self.getRelativeEventPoint( 0, 0 );
        var p = self.getRelativeEventPoint( clientWidth, clientHeight );
        var f = false;

        f = (o.x > 0 || o.y > 0 || p.x < svgWidth || p.y < svgHeight );

        return f;
    }

    // Mouse wheel handler
    function handleMouseWheel( evt ) {
        if( evt.preventDefault ) {
            evt.preventDefault();
        } else {
            evt.returnValue = false;
        }

        var delta;

        if( evt.wheelDelta ) {
            delta = evt.wheelDelta / 360;
        } else {
            delta = evt.detail / -9;
        }

        var z = Math.pow( 1.2, delta );

        var p = self.getRelativeMousePoint(evt) /*.getRelativeEventPoint( clientWidth / 2, clientHeight / 2 ) */
                .matrixTransform( viewport.getCTM().inverse() );

        var k = svg.createSVGMatrix().translate( p.x, p.y ).scale( z )
                .translate( -p.x, -p.y );
        var t = viewport.getCTM().multiply( k );

        self.setCTM( t );
        self.update();
    }

    // Mouse panning handlers
    var stateTf, stateOrigin, dp, up;

    function handleMouseDown( evt ) {
        if( evt.preventDefault ) {
            evt.preventDefault();
        } else {
            evt.returnValue = false;
        }

        panning = true;

        stateTf = viewport.getCTM().inverse();

        stateOrigin = self.getEventPoint( evt ).matrixTransform( stateTf );
    };

    function handleMouseUp( evt ) {
        if( evt.preventDefault ) {
            evt.preventDefault();
        } else {
            evt.returnValue = false;
        }

        if( panning ) {
            panning = false;
        }
    };

    function handleMouseMove( evt ) {
        if( evt.preventDefault ) {
            evt.preventDefault();
        } else {
            evt.returnValue = false;
        }

        if( panning ) {
            var p = self.getEventPoint( evt ).matrixTransform( stateTf );

            self.setCTM( stateTf.inverse().translate( p.x - stateOrigin.x,
                                                      p.y - stateOrigin.y ) );
            self.update();
        }
    };

    svg.addEventListener( 'mousedown', handleMouseDown, false );
    svg.addEventListener( 'mouseup', handleMouseUp, false );
    svg.addEventListener( 'mousemove', handleMouseMove, false );

    if( navigator.userAgent.toLowerCase().indexOf( 'webkit' ) >= 0 ) {
        svg.addEventListener( 'mousewheel', handleMouseWheel, false );
    } else {
        svg.addEventListener( 'DOMMouseScroll', handleMouseWheel, false );
    }

    // Create overlay divs

    var markerOverlay = document.createElement( 'div' );
    markerOverlay.setAttributeNS( null, 'id', 'markerOverlay' );
    markerOverlay.style.position = 'absolute';
    markerOverlay.style.overflow = 'hidden';
    markerOverlay.style.width = clientWidth + 'px';
    markerOverlay.style.height = clientHeight + 'px';
    markerOverlay.style.top = 0;
    markerOverlay.style.left = 0;
    markerOverlay.style.pointerEvents = 'none';

    var infoWindowOverlay = document.createElement( 'div' );
    infoWindowOverlay.setAttributeNS( null, 'id', 'infoWindowOverlay' );
    infoWindowOverlay.style.position = 'absolute';
    infoWindowOverlay.style.overflow = 'hidden';
    infoWindowOverlay.style.width = clientWidth + 'px';
    infoWindowOverlay.style.height = clientHeight + 'px';
    infoWindowOverlay.style.top = 0;
    infoWindowOverlay.style.left = 0;
    infoWindowOverlay.style.pointerEvents = 'none';

    container.appendChild( markerOverlay );
    container.appendChild( infoWindowOverlay );

    self.markerArray = new Array();
    self.infoWindowArray = new Array();

    self.container = container;
    self.markerOverlay = markerOverlay;
    self.infoWindowOverlay = infoWindowOverlay;
    self.svg = svg;
    self.viewport = viewport;

    self.clientWidth = clientWidth;
    self.clientHeight = clientHeight;
    self.svgWidth = svgWidth;
    self.svgHeight = svgHeight;

    // Initialize scale and position
    var scaleWidth = clientWidth / svgWidth;
    var scaleHeight = clientHeight / svgHeight;
    var scale = scaleWidth < scaleHeight ? scaleWidth : scaleHeight;
    if( !!scale ) {
        var s = viewport.getCTM().multiply( svg.createSVGMatrix().scale( scale ) );
        var p = self.getRelativeEventPoint( clientWidth / 2, clientHeight / 2 )
                .matrixTransform( s.inverse() );
        var t = s.translate( p.x -(svgWidth / 2), p.y - (svgHeight / 2) );
        self.setCTM( t );
    }
};

SVGMap.prototype.setCTM = function( matrix ) {
    var s = 'matrix(' + matrix.a + ',' + matrix.b + ',' + matrix.c + ',' + 
            matrix.d + ',' + matrix.e + ',' + matrix.f + ')';
    this.viewport.setAttribute( 'transform', s );
};

SVGMap.prototype.getRelativeMousePoint = function( evt ) {
    var p = this.svg.createSVGPoint();
    p.x = evt.clientX;
    p.y = evt.clientY;
    p = p.matrixTransform( this.svg.getScreenCTM().inverse() );
    return p;
};

SVGMap.prototype.getRelativeEventPoint = function( x, y ) {
    var p = this.svg.createSVGPoint();
    p.x = x;
    p.y = y;
    return p;
};

SVGMap.prototype.getRelativeScreenPoint = function( x, y ) {
    var p = this.svg.createSVGPoint();
    p.x = x;
    p.y = y;
    p = p.matrixTransform( this.svg.getScreenCTM() );
    return p;
};

SVGMap.prototype.getEventPoint = function( evt ) {
    var p = this.svg.createSVGPoint();
    p.x = evt.clientX;
    p.y = evt.clientY;
    return p;
};

SVGMap.prototype.hide = function() {
    if( this.svg.parentNode === this.container )
        this.container.removeChild( this.svg );
};

SVGMap.prototype.show = function() {
    if( !this.svg.parentNode )
        this.container.appendChild( this.svg );
};

SVGMap.prototype.update = function() {
    for( var i in this.markerArray ) {
        var marker = this.markerArray[i];
        var x = marker.position.x, y = marker.position.y;
        var p = this.getRelativeEventPoint( x, y );
        p = p.matrixTransform( this.viewport.getCTM() );
        marker.container.style.left = p.x - marker.offset.x + 'px';
        marker.container.style.top = p.y - marker.offset.y + 'px';
    }

    for( var j in this.infoWindowArray ) {
        var infoWindow = this.infoWindowArray[j];
        var x = infoWindow.position.x, y = infoWindow.position.y;
        var p = this.getRelativeEventPoint( x, y );
        p = p.matrixTransform( this.viewport.getCTM() );
        infoWindow.container.style.left = p.x - infoWindow.pixelOffset.x - infoWindow.container.clientWidth / 2 + 'px';
        infoWindow.container.style.top = p.y - infoWindow.pixelOffset.y - infoWindow.container.clientHeight - 20 + 'px';
    }
};

SVGMap.prototype.clearMarkerOverlay = function() {
    while( !!this.markerOverlay.firstChild ) {
        this.markerOverlay.removeChild( this.infoWindowOverlay.firstChild );
    }
};

SVGMap.prototype.clearInfoWindowOverlay = function() {
    while( !!this.infoWindowOverlay.firstChild ) {
        this.infoWindowOverlay.removeChild( this.infoWindowOverlay.firstChild );
    }
};

SVGMap.Marker = function( opts ) {
    var self = this;

    if( !opts ) {
        console.error( 'Fatal: No options specified' );
        return;
    }

    // Parameters
    var anchorPoint = { x: 0, y: 0 },
        animation   = undefined,
        clickable   = true,
        crossOnDrag = true,
        cursor      = 'normal',
        draggable   = false,
        flat        = false,
        icon        = '',
        map         = undefined,
        offset      = { x: 0, y: 0 },
        optimized   = true,
        position    = { x: 0, y: 0 },
        raiseOnDrag = true,
        shadow      = '',
        shape       = undefined,
        title       = '',
        visible     = true,
        zIndex      = -1;

    if( opts.hasOwnProperty( 'anchorPoint' ) ) anchorPoint = opts.anchorPoint;
    if( opts.hasOwnProperty( 'animation'   ) ) animation   = opts.animation;
    if( opts.hasOwnProperty( 'clickable'   ) ) clickable   = opts.clickable;
    if( opts.hasOwnProperty( 'crossOnDrag' ) ) crossOnDrag = opts.crossOnDrag;
    if( opts.hasOwnProperty( 'cursor'      ) ) cursor      = opts.cursor;
    if( opts.hasOwnProperty( 'draggable'   ) ) draggable   = opts.draggable;
    if( opts.hasOwnProperty( 'flat'        ) ) flat        = opts.flat;
    if( opts.hasOwnProperty( 'icon'        ) ) icon        = opts.icon;
    if( opts.hasOwnProperty( 'map'         ) ) map         = opts.map;
    if( opts.hasOwnProperty( 'offset'      ) ) offset      = opts.offset;
    if( opts.hasOwnProperty( 'optimized'   ) ) optimized   = opts.optimized;
    if( opts.hasOwnProperty( 'position'    ) ) position    = opts.position;
    if( opts.hasOwnProperty( 'raiseOnDrag' ) ) raiseOnDrag = opts.raiseOnDrag;
    if( opts.hasOwnProperty( 'shadow'      ) ) shadow      = opts.shadow;
    if( opts.hasOwnProperty( 'shape'       ) ) shape       = opts.shape;
    if( opts.hasOwnProperty( 'title'       ) ) title       = opts.title;
    if( opts.hasOwnProperty( 'visible'     ) ) visible     = opts.visible;
    if( opts.hasOwnProperty( 'zIndex'      ) ) zIndex      = opts.zIndex;

    if( !map ) {
        console.error( 'Fatal: No map specified' );
        return;
    }

    var container = document.createElement( 'div' );
    container.style.position = 'absolute';
    container.style.pointerEvents = 'auto';

    var image = document.createElement( 'img' );
    image.setAttributeNS( null, 'src', icon );

    container.appendChild( image );

    self.container = container;
    self.image = image;

    self.anchorPoint = anchorPoint;
    self.animation   = animation;
    self.clickable   = clickable;
    self.crossOnDrag = crossOnDrag;
    self.cursor      = cursor;
    self.draggable   = draggable;
    self.flat        = flat;
    self.icon        = icon;
    self.map         = map;
    self.offset      = offset;
    self.optimized   = optimized;
    self.position    = position;
    self.raiseOnDrag = raiseOnDrag;
    self.shadow      = shadow;
    self.shape       = shape;
    self.title       = title;
    self.visible     = visible;
    self.zIndex      = zIndex;

    map.markerOverlay.style.pointerEvents = 'auto';

    map.markerArray.push( self );
    map.markerArray.sort( function( a, b ) {
        var y1 = a.position.y, y2 = b.position.y;
        if( y1 < y2 ) return -1;
        if( y1 > y2 ) return 1;
        return 0;
    } );

    for( var i in map.markerArray ) {
        var marker = map.markerArray[i].container;

        if( marker.parentNode === map.markerOverlay ) {
            map.markerOverlay.removeChild( marker );
        }

        map.markerOverlay.appendChild( marker );
    }

    map.markerOverlay.appendChild( self.container );
    map.update();

    map.markerOverlay.style.pointerEvents = 'none';
};

SVGMap.Marker.prototype.click = function( callback ) {
    this.container.click = callback;
};

SVGMap.InfoWindow = function( opts ) {
    var self = this;

    // Parameters
    var content        = '',
        disableAutoPan = true,
        maxWidth       = '60%',
        pixelOffset    = { x: 0, y: 0 },
        position       = { x: 0, y: 0 },
        zIndex         = -1;

    if( !opts ) opts = new Object();
 
    if( opts.hasOwnProperty( 'content'     ) ) content     = opts.content;
    if( opts.hasOwnProperty( 'maxWidth'    ) ) maxWidth    = opts.maxWidth;
    if( opts.hasOwnProperty( 'pixelOffset' ) ) pixelOffset = opts.pixelOffset;
    if( opts.hasOwnProperty( 'position'    ) ) position    = opts.position;
    if( opts.hasOwnProperty( 'zIndex'      ) ) zIndex      = opts.zIndex;
    if( opts.hasOwnProperty( 'disableAutoPan' ) ) disableAutoPan = opts.disableAutoPan;

    var tmp = document.createElement( 'div' );
    tmp.appendChild( content );

    var container = document.createElement( 'div' );

    container.style.position = 'absolute';
    container.style.padding = '10px';
    container.style.backgroundColor = 'white';
    container.style.borderRadius = '2px';
    container.style.pointerEvents = 'auto';
    container.setAttributeNS( null, 'class', 'SVGMapInfoWindow' );

    container.innerHTML = tmp.innerHTML;

    self.container = container;
};

SVGMap.InfoWindow.prototype.open = function( map, anchor ) {
    var self = this;

    if( !map ) {
        console.error( 'Must specify map to draw on' );
        return;
    }

    if( !!anchor ) {
        self.position = anchor.position;
        self.pixelOffset = anchor.anchorPoint;
    }

    map.infoWindowArray.push( self );
    map.clearInfoWindowOverlay();
    map.infoWindowOverlay.appendChild( self.container );

    if( self.container.clientWidth > map.clientWidth * 0.6 ) {
        self.container.style.width = map.clientWidth * 0.6 + 'px';
    } else if( self.container.clientWidth < 80 ) {
        self.container.style.width = '80px';
    } else {
        self.container.style.width = self.container.clientWidth;
    }

    map.update();
};
