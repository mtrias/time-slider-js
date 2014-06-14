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
            secondsAgo: function (seconds) {
                if (0 == seconds) return 'now';
                return moment().subtract('seconds', seconds).format("h:ma - ll");
            },
            tick: function (seconds) {

                if (0 === seconds) {
                    return 'now';
                }

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

        axisContainer,

        drag = d3.behavior.drag();


    // ----


    function timeSlider(selection)
    {
        selection.each(function() {


            // working on a simplified range for now
            var
                mainDiv = d3.select(this),

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
            value = value || {from: CONF.steps[3], until: range[0]};


            mainDiv.classed("time-slider", true);

            // tooltips
            var tooltipsContainer = mainDiv.append('div').attr("class", "tooltips");

            var tooltips = {
                from: tooltipsContainer.append('div').attr("class", FROM),
                until: tooltipsContainer.append('div').attr("class", UNTIL),
                mouse: tooltipsContainer.append('div').attr("class", 'mouse'),
            };

            tooltips.from.html('from:<br/>');
            tooltips.until.html('to:<br/>');

            var tooltipTexts = {
                from: tooltips.from.append('span'),
                until: tooltips.until.append('span')
            }

            // hover DIV
            var sliderDiv = mainDiv.append('div')
                .attr("class", "slider");

            // receive clicks in the main area so it's easy to select times.
            mainDiv.on('click', onClick);

            // tooltips control
            mainDiv.on('mousemove', function () {

                updateTooltipsText();
                updateMouseTooltip(d3.event.offsetX || d3.event.layerX);

                var pos = d3.event.offsetX || d3.event.layerX,
                    active = nearestHandler(pos);
                tooltipTexts[active].classed('active', true);
                tooltipTexts[invert(active)].classed('active', false);

            }).on('mouseenter', function () {

                //show(tooltips['mouse']);

            }).on('mouseleave', function () {

                tooltipTexts[FROM].classed('active', false);
                tooltipTexts[UNTIL].classed('active', false);

                updateTooltipsText();
                // show(tooltips[FROM]);
                // show(tooltips[UNTIL]);
                hide(tooltips['mouse']);

            });


            // main DIV container
            var area = sliderDiv.append('div').classed("area", true);



            // cache the slider width
            width = parseInt(area.style("width"), 10);

            // from slider handle
            handles[FROM] = area.append("a")
                .attr("class", "handle from")
                .on("click", stopPropagation)
                .call(drag);

            // until slider handle
            handles[UNTIL] = area.append("a")
                .attr("class", "handle until")
                .on("click", stopPropagation)
                .call(drag);

            // interval marker
            var slice = area.append('div').classed("slice", true);

            // position the left handler at the initial value
            handles[FROM].style("right", formatters.pct(scale.invert(value[ FROM ])));

            // position the right handler at the initial value
            handles[UNTIL].style("right", formatters.pct(scale.invert(value[ UNTIL ])));

            // position the range rectangle at the initial value
            slice.style({
                left: (100 - parseFloat(formatters.pct(scale.invert(value[ FROM ])))) + "%",
                right: formatters.pct(scale(value[ UNTIL ]))
            });

            updateTooltipsText();

            createAxis(mainDiv);


            // ----


            drag.on("drag", onDrag);

            sliderDiv.on("click", onClick);

            // Adjust all things after a window resize
            d3.select(window).on('resize', function () {
                width = parseInt(container.style("width"), 10);
                axisScale.range([width, 0]);
                axisContainer.attr("width", width);
                axisContainer.transition().call(axis);
            });


            // ----


            function nearestHandler(pos) {
                var currLpos = val2left(value[FROM]),
                    currRpos = val2left(value[UNTIL]),
                    active = UNTIL;

                // console.debug(pos, d3.event.x);

                if (Math.abs(pos - currLpos) < Math.abs(pos - currRpos)){
                    active = FROM;
                }

                return active;
            }

            function updateTooltipsText() {
                tooltipTexts[FROM].text( formatters.secondsAgo(value[FROM]) );
                tooltipTexts[UNTIL].text( formatters.secondsAgo(value[UNTIL]) );
            }

            function updateMouseTooltip(pos) {
                var val = formatters.secondsAgo(pos2val(pos));
                tooltips.mouse
                    .style("left", formatters.pct( pos / width ))
                    .text(val);

            }

            function show(node)
            {
                node.style("visibility", "visible");
            }

            function hide(node) {
                node.style("visibility", "hidden");
            }

            function invert(handler) {
                return (handler === UNTIL) ? FROM : UNTIL;
            }

            function createAxis(container)
            {
                axis = d3.svg.axis()
                    .ticks(Math.round(width / 100))
                    .tickFormat(formatters.tick)
                    .tickValues(CONF.steps)
                    .tickPadding(6)
                    .tickSize(8)
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
                    .classed("axis", true)
                    .on("click", stopPropagation);

                // For now we also accept clicks on the svg, to make it easy to use
                axisContainer.on('click', onClick);

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
            function moveHandle(handle, pos)
            {
                var newValue = pos2val(pos),
                    currentValue = value[handle];
                console.debug('clicked position: %f/%2f, value: %f', pos, (width - pos) / width, newValue);

                if (currentValue !== newValue) {
                    var oldPos = formatters.pct(val2pct(currentValue)),
                        newPos = formatters.pct(val2pct(newValue));

                    value[handle] = newValue;
                    console.log("New value {from:%s, until:%s} handler:%s. New pos %s", value.from, value.until, handle, newPos);

                    if ( value[ FROM ] <= value[ UNTIL ] ) { console.warn('problem', value); return; }

                    if ( UNTIL === handle )
                    {
                        slice.transition().styleTween("right", interpolator(oldPos, newPos))
                    }

                    if (FROM === handle)
                    {
                        var newRight = 100 - parseFloat(newPos) + "%";
                        var oldRight = 100 - parseFloat(oldPos) + "%";

                        slice.transition().styleTween("left", interpolator(oldRight, newRight));
                    }

                    handles[handle].transition().styleTween("right", interpolator(oldPos, newPos));
                }

                updateTooltipsText();
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
                    active = nearestHandler(pos);

                // moving the closest handler to the position _pos_
                moveHandle(active, pos);
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

                moveHandle(active, Math.max(0, Math.min(width, d3.event.x)));
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
