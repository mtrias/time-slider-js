d3.timeSlider = function module() {
    "use strict";


    var FROM = 'from', UNTIL = 'until',

        MIN = 60, HOUR = 60 * MIN, DAY = 24 * HOUR,

        CONF = {
            axis: {
                height: 30
            },
            steps: [
                0,
                10 * MIN,
                30 * MIN,
                1 * HOUR,
                3 * HOUR,
                12 * HOUR,
                1 * DAY,
                7 * DAY,
                30 * DAY
            ]
        },

        axis,

        value,

        handles = {
            from: undefined,
            until: undefined
        },

        /**
         * The active handle
         */
        active = FROM,

        /**
         * The scale of the slider, it transforms the domain [0, 1] (a percentage of the slider) to the range of time/seconds ago
         * Is really a polylinear scale, so the domain is not just [0, 1] but a serie of intermediate numbers, as well as the range
         */
        scale = d3.scale.linear(),

        container,

        callbacks = {},

        formatters = {
            pct: d3.format(".2%"),
            tick: function (seconds) {

                if (seconds < 1 * MIN) {
                    return seconds + 's';
                }

                if (seconds < 1 * HOUR) {
                    return seconds / 60 + 'm';
                }

                if (seconds < 1 * DAY) {
                    return seconds / (60 * 60) + 'h';
                }

                return seconds / (60 * 60 * 24) + 'd';
            },
        },

        width,

        axisScale,

        axisContainer;


    // ----


    function timeSlider(selection)
    {
        selection.each(function() {


            // working on a simplified range for now
            var
                //timeSteps = _(CONF.steps).sortBy().value(),
                //range = [timeSteps[0], timeSteps[4]],
                range = _(CONF.steps).sortBy().value(),

                // working on a simplyfied scale for now
                domain = _.map(range, function (val, ind, range) { return ind ? ind/(range.length - 1) : 0; } );
                //domain = [0, 1];

            scale.range( range ).domain( domain );

            console.debug("domain", domain);
            console.debug("range", range);


            // Initial value
            value = value || {from: CONF.steps[1], until: range[0]};

            // main DIV container
            container = d3.select(this).classed("time-slider", true);

            // cache the slider width
            width = parseInt(container.style("width"), 10);

            var drag = d3.behavior.drag();

            // from slider handle
            handles[FROM] = container.append("a")
                .attr("class", "time-slider-handle handle-from")
                .on("click", stopPropagation)
                .call(drag);

            // until slider handle
            handles[UNTIL] = container.append("a")
                .attr("class", "time-slider-handle handle-until")
                .on("click", stopPropagation)
                .call(drag);

            // interval marker
            var slice = container.append('div').classed("time-slider-range", true);

            // position the left handler at the initial value
            handles[FROM].style("right", formatters.pct(scale.invert(value[ FROM ])));

            // position the right handler at the initial value
            handles[UNTIL].style("right", formatters.pct(scale.invert(value[ UNTIL ])));

            // position the range rectangle at the initial value
            slice.style({
                left: (100 - parseFloat(formatters.pct(scale.invert(value[ FROM ])))) + "%",
                right: formatters.pct(scale(value[ UNTIL ]))
            });

            createAxis(container);


            // ----


            drag.on("drag", onDrag);

            container.on("click", onClick);

            // Adjust all things after a window resize
            d3.select(window).on('resize', function () {
                width = parseInt(container.style("width"), 10);
                axisScale.range([width, 0]);
                axisContainer.attr("width", width);
                axisContainer.transition().call(axis);
            });


            // ----


            function createAxis(container)
            {
                axis = d3.svg.axis()
                    .ticks(Math.round(width / 100))
                    .tickFormat(formatters.tick)
                    .tickValues(CONF.steps)
                    .orient("bottom");

                //var axis_domain = [range[0], range[range.length - 1]];
                //var axis_range = [width, 0];
                //var axis_domain = _.map(scale.range(), function (seconds) { return moment().add('s', seconds).toDate(); });
                //var axis_domain = _.map(scale.range(), function (val, ind, domain) { return ind ? (width / domain.length) * ind : 0; });
                var axis_domain = scale.range(),
                    axis_range = _.chain(scale.domain()).map(function (val) { return val * width; }).reverse().value();

                console.log("axis domain", axis_domain);
                console.log("axis range", axis_range);

                axisScale = scale.copy()
                    .domain(axis_domain)
                    .range(axis_range);
                axis.scale(axisScale);

                // Create SVG axis container
                axisContainer = container.append("svg")
                    .classed("time-slider-axis time-slider-axis-" + axis.orient(), true)
                    .on("click", stopPropagation);

                // axis

                axisContainer.attr({
                        width: width,
                        height: CONF.axis.height
                    })
                    .call(axis);
            }

            function interpolator (oldVal, newVal) {
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

            /**
             * Given a position of a mouse click, moves one slider handle to that position
             */
            function moveHandle(pos)
            {
                var newValue = pos2val(pos),
                    currentValue = value[active];
                console.debug('clicked position: %f/%2f, value: %f', pos, (width - pos) / width, newValue);

                if (currentValue !== newValue) {
                    var oldPos = formatters.pct(val2pct(currentValue)),
                        newPos = formatters.pct(val2pct(newValue));

                    value[active] = newValue;
                    console.log("New value {from:%s, until:%s} %s changed. New pos %s", value.from, value.until, active, newPos);

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


    // ----


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

    return timeSlider;

};
