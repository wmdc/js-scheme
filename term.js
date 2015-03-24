jQuery(function($, undefined) {
    function contextToTreeRepresentation(context) {
	var data = [];
	for(p in jsScheme.globalContext) {
	    var value = jsScheme.globalContext[p];

	    data.push({
		label: p, // + ': ' + jsScheme.globalContext[p],
		children: [{
		    label: typeof value === 'function' ? 'procedure' : JSON.stringify(value)
		}]
	    });
	}
	return data;
    };

    var initialTreeRender = true;

    function refreshTreeRepresentation(context) {
	var tree = contextToTreeRepresentation(context);
	var $tree = $('#environment-tree');

	if(initialTreeRender) {
	    $tree.tree({
		data: tree
	    });
	    initialTreeRender = false;
	} else {
	    $tree.tree('loadData', tree);
	}
	// display all nodes as open by default
	$tree.tree('getTree').iterate(
	    function(node, level) {
		if (! node.hasChildren()) {
		    // This will open the folder
		    $tree.tree('selectNode', node);
		    return false;
		}
		return true;
	    }
	);
    }

    $('#term').terminal(function(command, term) {
	if (command !== '') {
	    var result = jsScheme.eval(command);
	    if (result != undefined) {
		term.echo(String(result));
	    }
	    refreshTreeRepresentation(jsScheme.globalContext);
	}
    }, {
	greetings: 'Scheme Interpreter',
	name: 'scheme_demo',
	height: 800,
	width: 1000,
	prompt: 'scheme> '});

    refreshTreeRepresentation(jsScheme.globalContext);
});
