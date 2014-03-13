window.onload = function() {
    var map = new SVGMap( 'div#map', 'NC_000913.svg' ); 

    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function() {
        if( xhr.readyState === 4 ) {
            if( xhr.status === 200 ) {
                var list = JSON.parse( xhr.responseText );
                for( var i = 0; i < list.length; ++i ) {
                    ( function( e ) {
                        var marker = new SVGMap.Marker( {
                            map: map,
                            position: { x: e.x, y: e.y },
                            icon: 'pin.png',
                            offset: { x: 7, y: 35 },
                            anchorPoint: { x: 0, y: 39 }
                        } );

                        var infoWindow = new SVGMap.InfoWindow( {
                            position: { x: e.x, y: e.y },
                            content: formatContent( e )
                        } );

                        marker.container.onclick = function() {
                            infoWindow.open( map, marker );
                        };
                    } )( list[i] );
                }
            } else {
                console.error( 'Fatal: Error in XHR, status: ' + xhr.status );
            }
        }
    };

    xhr.open( 'GET', 'data.json' );
    xhr.send();
};

function formatContent( e ) {
    var base = document.createElement( 'div' );

    if( !!e.pdb.length ) {
        var pdb = document.createElement( 'img' );
        pdb.setAttributeNS( null, 'src', 'http://au.expasy.org/cgi-bin/view-pdb?view=gif&width=200&pdb=' + e.pdb );
        pdb.style.border = '1px solid #cccccc';
        pdb.style.margin = '4px 10px';
        pdb.style.padding = '10px';
        pdb.style.align = 'right';
        pdb.style.width = 200;
        pdb.style.height = 200;
        base.appendChild( pdb );
    }

    base.innerHTML += '<b>' + e.gene + '</b>: ' + e.annotation + '<br><br>';
    base.innerHTML += e.note + '<br><br>';

    base.innerHTML += '<div style="font-size: 10pt;">';
    if( !!e.gi.length )
        base.innerHTML += '<a href="http://www.nbci.nlm.nih.gov/entrez/viewer.fcgi?db=protein&val=' + e.gi + '" target="_blank">RefSeq</a> | ';
    if( !!e.pdb.length )
        base.innerHTML += '<a href="http://au.expasy.org/cgi-bin/get-pdb.pl?' + e.pdb + '" target="_blank">PDB</a> | ';
    if( !!e.sw.length )
        base.innerHTML += '<a href="http://au.expasy.org/uniprot/' + e.sw + '" target="_blank">UniProt</a> | ';
    if( !!e.locustag.length && !!e.keggid.length )
        base.innerHTML += '<a href="' + e.gi + '" target="_blank">KEGG</a>';
    base.innerHTML += '</div>';

    return base;
}
