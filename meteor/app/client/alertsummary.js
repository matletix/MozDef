/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at http://mozilla.org/MPL/2.0/.
Copyright (c) 2014 Mozilla Corporation

Contributors:
Jeff Bryner jbryner@mozilla.com
Anthony Verez averez@mozilla.com
 */

if (Meteor.isClient) {

    Template.alertssummary.events({
        "click .reset": function(e,t){
            dc.filterAll();
            dc.redrawAll();
            }
    });   
 
    Template.alertssummary.alertsCount = function () {
      return alerts.find({}).count();
    };
    
    Template.alertssummary.rendered = function() {
        //console.log('rendered');
        var ringChartCategory   = dc.pieChart("#ringChart-category");
        var ringChartSeverity   = dc.pieChart("#ringChart-severity");
        var volumeChart         = dc.barChart("#volumeChart");
        // set our data source
        Meteor.subscribe("alerts");
        var alertsData=alerts.find({},{fields:{events:0,eventsource:0}, sort: {utcepoch: 'desc'},limit:1}).fetch();
        var ndx = crossfilter();
        function descNumbers(a, b) {
            return b-a;
        }
        
        Deps.autorun(function() {
            //console.log('deps autorun');
            
            alertsData=alerts.find({},{fields:{events:0,eventsource:0}, sort: {utcepoch: 'desc'}, limit: 1000, reactive:false}).fetch();
            var alertsCount=alerts.find({}).count();
            //parse, group data for the d3 charts
            alertsData.forEach(function (d) {
                d.url = getSetting('kibanaURL') + '#/dashboard/script/alert.js?id=' + d.esmetadata.id;
                d.jdate=new Date(Date.parse(d.utctimestamp));
                d.dd=moment.utc(d.utctimestamp)
                d.month = d.dd.get('month');
                d.hour = d.dd.get('hour')
                d.epoch=d.dd.unix();
            });        
            ndx = crossfilter(alertsData);
            if ( ndx.size() >0){
                var all = ndx.groupAll();
                var severityDim = ndx.dimension(function(d) {return d.severity;});
                var categoryDim = ndx.dimension(function(d) {return d.category;});
                var hourDim = ndx.dimension(function (d) {return d3.time.hour(d.jdate);});
                var epochDim = ndx.dimension(function(d) {return d.utcepoch;});
                var format2d = d3.format("02d");
                var volumeByHourGroup = hourDim.group().reduceCount();
                ndx.remove();
                ndx.add(alertsData);
                ringChartCategory
                    .width(150).height(150)
                    .dimension(categoryDim)
                    .group(categoryDim.group())
                    .label(function(d) {return d.key; })
                    .innerRadius(30)
                    .expireCache();
        
                ringChartSeverity
                    .width(150).height(150)
                    .dimension(severityDim)
                    .group(severityDim.group())
                    .label(function(d) {return d.key; })
                    .innerRadius(30)
                    .expireCache();
                dc.dataCount(".record-count")
                    .dimension(ndx)
                    .group(all);            
                dc.dataTable(".alerts-data-table")
                    .dimension(epochDim)
                    .size(100)
                    .group(function (d) {
                            //return d.dd.getFullYear() + "/" + format2d(d.dd.getMonth() + 1) + "/" + format2d(d.dd.getDate());
                            //return moment.duration(d.dd).humanize() +' ago';
                            return d.dd.local().format("ddd, hA"); 
                            })
                    .sortBy(function(d) {
                        return d.utcepoch;
                    })
                    .order(descNumbers)                    
                    .columns([
                        function(d) {return d.jdate;},
                        function(d) {return '<a href="/alert/' + d.esmetadata.id + '">' + d.esmetadata.id + '</a><br> <a href="' + d.url + '">see in kibana</a>';},
                        function(d) {return d.severity;},
                        function(d) {return d.category;},
                        function(d) {return d.summary;}
                    ])
                    .expireCache();
                
                volumeChart
                    .width(600)
                    .height(150)
                    .dimension(hourDim)
                    .group(volumeByHourGroup)
                    .x(d3.time.scale().domain([moment(hourDim.bottom(1)[0].dd).subtract('hours', 1)._d, moment(hourDim.top(1)[0].dd).add('hours', 1)._d]))
                    .expireCache();
                dc.renderAll();
            }
        }); //end deps.autorun    
    };
 
};