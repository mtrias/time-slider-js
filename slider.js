d3.timeSlider = function module() {
    "use strict";


    var FROM = 'from', UNTIL = 'until', MIN = 60, HOUR = 60 * MIN, DAY = 24 * HOUR;

    var CONF = {
        axis: {
            height: 30
        }
    };

    // Public variables
    var axis,
        value,
        handles = {from: undefined, until: undefined},
        active = FROM,

        /**
         * The scale of the slider, it transforms the domain [0, 1] (a percentage of the slider) to the range of time
         * Is really a polylinear scale, so the domain is not just [0, 1] but a serie of intermediate numbers, as well as the range
         */
        scale;

    // Private variables
    var container,
        callbacks = {},
        dispatch = d3.dispatch("slide", "slideend"),
        pctFormat = d3.format(".2%"),
        tickFormat = d3.format(".0"),
        width,
        axisScale,
        axisSvg,
        axisContainer;

    function timeSlider(selection)
    {
        selection.each(function() {

            var timeSteps = _([
                0,
                10 * MIN,
                30 * MIN,
                1 * HOUR,
                3 * HOUR,
                12 * HOUR,
                1 * DAY,
                7 * DAY,
                30 * DAY]
            ).sortBy().value();

            // working on a simplified range for now
            var range = [timeSteps[0], timeSteps[1]];

            // working on a simplyfied scale for now
            // var domain = _.map(range, function (val, ind, range) { return ind ? ind/(range.length - 1) : 0; } )
            var domain = [0, 1];

                scale = d3.scale.linear()
                    .range( range )
                    .domain( domain );

            console.debug("domain", domain);
            console.debug("range", range);


            // Start value
            value = value || {from: range[1], until: range[0]};
            console.debug("initial value", value);

            // DIV container
            container = d3.select(this).classed("time-slider", true);

            // cache the slider width
            width = parseInt(container.style("width"), 10);

            var drag = d3.behavior.drag();
            drag.on('dragend', function () {
                dispatch.slideend(d3.event, value);
            });

            // from slider handle
            handles[FROM] = container.append("a")
                .attr("class", "time-slider-handle handle-from")
                .attr("xlink:href", "#")
                .on("click", stopPropagation)
                .call(drag);

            // until slider handle
            handles[UNTIL] = container.append("a")
                .attr("class", "time-slider-handle handle-until")
                .attr("xlink:href", "#")
                .on("click", stopPropagation)
                .call(drag);

            // interval marker
            var slice = d3.select(this).append('div').classed("time-slider-range", true);

            // position the left handler
            handles[FROM].style("right", pctFormat(scale.invert(value[ FROM ])));

            // position the right handler
            handles[UNTIL].style("right", pctFormat(scale.invert(value[ UNTIL ])));

            // position the range rectangle
            slice.style({
                left: (100 - parseFloat(pctFormat(scale.invert(value[ FROM ])))) + "%",
                right: pctFormat(scale(value[ UNTIL ]))
            });

            createAxis(container);

            drag.on("drag", onDrag);

            container.on("click", onClick);

            // Adjust all things after a window resize
            d3.select(window).on('resize', function () {
                width = parseInt(container.style("width"), 10);
                axisScale.range([width, 0]);
                d3.rebind(timeSlider, dispatch, "on");
                axisSvg.attr("width", width);
                axisContainer.transition().call(axis);
            });

            // ----


            function createAxis(container)
            {
                axis = d3.svg.axis()
                    .ticks(Math.round(width / 100))
                    .tickFormat(tickFormat)
                    .orient("bottom");

                var axis_range = [width, 0];
                // var axis_range = _.map(scale.domain(), function (val, ind, domain) { return ind ? (width / domain.length) * ind : 0; });

                axisScale = scale.copy()
                    .domain([range[0], range[range.length - 1]])
                    .range(axis_range);
                axis.scale(axisScale);

                // Create SVG axis container
                axisSvg = container.append("svg")
                    .classed("time-slider-axis time-slider-axis-" + axis.orient(), true)
                    .on("click", stopPropagation);

                axisContainer = axisSvg.append("g");

                // axis

                axisSvg.attr({
                    width: width,
                    height: CONF.axis.height
                });

                if (axis.orient() === "top")
                {
                    axisSvg.style("top", "-" + CONF.axis.height + "px");
                } else { // bottom
                }

                axisContainer.call(axis);
            }

            function interpolator (oldVal, newVal)
            {
                return function () {
                    return d3.interpolate(oldVal, newVal);
                };
            }

            function val2left (val) {
                return (1 - val2pct(val)) * width;
            }

            function val2right (val) {
                return val2pct(val) * 100 / width;
            }

            function val2pct (val) {
                return scale.invert(val);
            }

            function pos2val (pos) {
                return scale((width - pos) / width);
            }

            // Move slider handle on click/drag
            function moveHandle(pos)
            {
                var newValue = pos2val(pos),
                    currentValue = value[active];
                console.debug('clicked position: %f/%2f, value: %f', pos, (width - pos) / width, newValue);

                if (currentValue !== newValue) {
                    var oldPos = pctFormat(val2pct(currentValue)),
                        newPos = pctFormat(val2pct(newValue));

                    value[active] = newValue;
                    console.log("New value {from:%s, until:%s} %s changed", value.from, value.until, active);
                    console.log("New pos %s", newPos);
                    dispatch.slide(d3.event, value );

                    if ( value[ FROM ] <= value[ UNTIL ] ) { console.warn('problem', value); return; }

                    if ( UNTIL === active )
                    {
                        slice.transition().styleTween("right", interpolator(oldPos, newPos))
                    }

                    if (FROM === active)
                    {
                        var newRight = 100 - parseFloat(newPos) + "%";
                        var oldRight = 100 - parseFloat(oldPos) + "%";

                        slice.transition().styleTween("left", interpolator(oldRight, newRight));
                    }

                    handles[active].transition().styleTween("right", interpolator(oldPos, newPos));
                }
            }

            function notifyChange()
            {
                if (_.has(callbacks, 'change')) {
                    callbacks.change(value);
                }
            }

            function onClick()
            {
                var pos = d3.event.offsetX || d3.event.layerX,
                    currLpos = val2left(value[FROM]),
                    currRpos = val2left(value[UNTIL]);

                console.log(pos, d3.event.x);

                // moving the closest handler
                active = UNTIL;
                if (Math.abs(pos - currLpos) < Math.abs(pos - currRpos)){
                    active = FROM;
                }

                moveHandle(pos);
                notifyChange();
            }

            function onDrag()
            {
                var target = d3.select(d3.event.sourceEvent.target);

                if ( target.classed('handle-from') ) {
                    active = FROM;

                } else if ( target.classed('handle-until') ) {
                    active = UNTIL;

                }

                moveHandle(Math.max(0, Math.min(width, d3.event.x)));
                notifyChange();
            }

            function stopPropagation()
            {
                d3.event.stopPropagation();
            }

        });

    }

    timeSlider.value = function(set) {
        if (!arguments.length) return value;
        value = set;
        return timeSlider;
    };

    timeSlider.onChange = function(callback) {
        if (arguments.length) {
            callbacks.change = callback;
        }
        return timeSlider;
    };

    d3.rebind(timeSlider, dispatch, "on");

    return timeSlider;

};
