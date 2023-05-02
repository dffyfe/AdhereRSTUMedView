// Change version number when it refuses to update v 1.0

/**
 * The JavaScript API for interacting with the AdhereR SVG plot (assumed embedded in an HTML document)
 *
 * Using the documentation standard described here:
 * https://make.wordpress.org/core/handbook/best-practices/inline-documentation-standards/javascript/
 *
 * (c) Dan Dediu [ddediu@gmail.com], 2019
 */

// Comments about specific browsers/platforms:
//  - IE11 on Windows 10:
//      - does not allow function arguments with default values -> use === undefined as a replacement in the function body
//      - does not implement getElementsByClassName() so use: https://stackoverflow.com/questions/7410949/javascript-document-getelementsbyclassname-compatibility-with-ie
//      - does not implement hasAttribute() so use: https://andrewdupont.net/2007/01/10/code-hasattribute-for-ie/

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
if (!Object.keys) {
  Object.keys = (function() {
    'use strict';
    var hasOwnProperty = Object.prototype.hasOwnProperty,
        hasDontEnumBug = !({ toString: null }).propertyIsEnumerable('toString'),
        dontEnums = [
          'toString',
          'toLocaleString',
          'valueOf',
          'hasOwnProperty',
          'isPrototypeOf',
          'propertyIsEnumerable',
          'constructor'
        ],
        dontEnumsLength = dontEnums.length;

    return function(obj) {
      if (typeof obj !== 'function' && (typeof obj !== 'object' || obj === null)) {
        throw new TypeError('Object.keys called on non-object');
      }

      var result = [], prop, i;

      for (prop in obj) {
        if (hasOwnProperty.call(obj, prop)) {
          result.push(prop);
        }
      }

      if (hasDontEnumBug) {
        for (i = 0; i < dontEnumsLength; i++) {
          if (hasOwnProperty.call(obj, dontEnums[i])) {
            result.push(dontEnums[i]);
          }
        }
      }
      return result;
    };
  }());
}

// From: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray
if (!Array.isArray) {
  Array.isArray = function(arg) {
    return Object.prototype.toString.call(arg) === '[object Array]';
  };
}


// Simulate a namespace 'adh_svg' to avoid potential conflicts with other JavaScript libraries:
var adh_svg = { // begin namespace

  // The SVG plot's ID:
  plot_id : 'adherence_plot',

  // SVG placeholder (if any):
  svg_placeholder_file_name : '',

  // Default values so we are able to restore them later if need be:
  label_style_default : "color: black", // the default lablel CSS style
  label_style_disabled : "color: #aaa;", // the disabled label look
  default_svg_width : "auto", default_svg_height : "auto", // default SVG size
  //default_font_size_title : "15px", // default axes font sizes
  default_font_size_axis_names : {"x":"10px", "y":"10px"}, // default axes names font sizes
  default_font_size_axis_labels : {"x":"8px", "y":"8px"}, // default axes labels font sizes
  interm_default_svg_width: "auto", interm_default_svg_height: "auto", // save interm svg width and height before using the zoom box, doesn't seem to be needed for modern browsers

  /**
   * Check if browser supports embedded SVG
   * using: https://css-tricks.com/a-complete-guide-to-svg-fallbacks/
   * @param {HTMLElement} node  The element.
   * @param {String} classname  The class name.
   * @return {Array} the child elements of the given class.
   */
  is_embedded_SVG_supported : function() {
    var div = document.createElement('div');
    div.innerHTML = '<svg/>';
    return (div.firstChild && div.firstChild.namespaceURI) == 'http://www.w3.org/2000/svg';
  },


  /**
   * IE does not implement getElementsByClassName()
   * so re-implement it using: https://stackoverflow.com/questions/7410949/javascript-document-getelementsbyclassname-compatibility-with-ie
   * @param {HTMLElement} node  The element.
   * @param {String} classname  The class name.
   * @return {Array} the child elements of the given class.
   */
  _getElementsByClassName : function(node, classname) {
    if(!node.getElementsByClassName) {
      // getElementsByClassName() is not implemennted, so fake it:
      var a = [];
      var re = new RegExp('(^| )'+classname+'( |$)');
      var els = node.getElementsByTagName("*");
      for(var i=0,j=els.length; i<j; i++)
          if(re.test(els[i].getAttribute('class'))) a.push(els[i]);
      return a;
    } else
    {
      // getElementsByClassName() is implemented, so use it:
      return node.getElementsByClassName(classname);
    }
  },

  /**
   * IE does not implement hasAttribute()
   * so re-implement it using: https://andrewdupont.net/2007/01/10/code-hasattribute-for-ie/
   * @param {HTMLElement} node  The element.
   * @param {String} attrname  The attribute name.
   * @return {Boolean} true if node has the attribute.
   */
  _hasAttribute : function(node, attrname) {
    if(!node.hasAttribute) {
      // hasAttribute() is not implemennted, so fake it:
      var x = node.attributes[attrname];
      return (typeof x != "undefined");
    } else
    {
      // getElementsByClassName() is implemented, so use it:
      return node.hasAttribute(attrname);
    }
  },


  /**
   * Given an SVG element and an attribute, return the attribute's value
   * @param {String} elem  The SVG element.
   * @param {String} attr  The SVG attribute name.
   * @param {String} elem_type  Some types of elements require a special mapping to CSS (e.g., fonts).
   * @return {String}   the attribute value.
   */
  get_svg_attribute : function(elem, attr, elem_type) {
    if( !elem || elem.length == 0 ) {
      return undefined;
    } else {
      if( elem.length > 0 ) elem = elem[0]; //assume that for arrays the first element is enough

      if( adh_svg._hasAttribute(elem, attr) ) {
        return elem.getAttribute(attr);
      } else
      {
        // SVG attribute may require translation to CSS:
        switch(attr) {
          case "fill":
            if( elem_type == "font" ) {
              return !elem.style.color ? undefined : elem.style.color;
            } else {
              return !elem.style.fill ? undefined : elem.style.fill;
            }
            break;
          case "font-size":
            return !elem.style.fontSize ? undefined : elem.style.fontSize;
            break;
          case "visibility":
            return !elem.style.visibility ? undefined : elem.style.visibility;
            break;
          default:
            return undefined;
        }
      }
    }
  },

  /**
   * Given an SVG element, an attribute and a vlue, set the attribute's value
   * @param {String} elem  The SVG element.
   * @param {String} attr  The SVG attribute name.
   * @param {String} val   The attribute's new value.
   * @param {String} elem_type  Some types of elements require a special mapping to CSS (e.g., fonts).
   * @param {Boolean} force_svg_attr  If undefined or true, set the SVG attribute avan if not yet defined (needed in some cases for some browsers).
   */
  set_svg_attribute : function(elem, attr, val, elem_type, force_svg_attr) {
    if( !elem || elem.length == 0 ) {
      return;
    } else {
      // Local function dealing with a single element at a time:
      function _set_svg_attribute_for_element(elem, attr, val, elem_type) {
        if( force_svg_attr === undefined || force_svg_attr || adh_svg._hasAttribute(elem, attr) ) {
          elem.setAttribute(attr, val);
        } else
        {
          // SVG attribute may require translation to CSS:
          switch(attr) {
            case "fill":
              if( elem_type == "font" ) {
                elem.style.color = val;
              } else {
                elem.style.fill = val;
              }
              break;
            case "font-size":
              elem.style.fontSize = val;
              break;
            case "visibility":
              elem.style.visibility = val;
              break;
          }
        }
      }

      if( elem.length > 0 ) {
        for(i=0; i<elem.length; i++) _set_svg_attribute_for_element(elem[i], attr, val, elem_type);
      } else {
        _set_svg_attribute_for_element(elem, attr, val, elem_type);
      }
    }
  },


  /**
   * Is an SVG element (or array thereof) visible?
   * @param {String}  elem  The SVG element.
   * @return {Boolean} True if visible.
   */
  is_visible_svg_element : function(elem) {
    return adh_svg.get_svg_attribute(elem, "visibility") != "hidden"; //  assume visible unless explicitely hidden...
  },

  /**
   * Show/hide one (or more) SVG element(s).
   * @param {String}  elem  The SVG element(s).
   * @param {Boolean} show  If undefined or true, show it, otherwise hide it.
   */
  show_svg_element : function(elem, show) {
    adh_svg.set_svg_attribute(elem, "visibility", (show === undefined || show) ? "visible" : "hidden");
  },


  /**
   * Get the SVG image's backgound color.
   * @return {String}   the background color (or None).
   */
  get_bkg_color : function() {
    svg = document.querySelector('.adherence_plot.index' + GraphIndex);
    plotting_areas = adh_svg._getElementsByClassName(svg, "plotting-area-background");
    return adh_svg.get_svg_attribute(plotting_areas, "fill");
  },

  /**
   * Change the SVG image's backgound color.
   * @param {String} c  The new background color.
   * @return {None}
   */
  set_bkg_color : function(c) {
    svg = document.querySelector('.adherence_plot.index' + GraphIndex);
    plotting_areas = adh_svg._getElementsByClassName(svg, "plotting-area-background");
    adh_svg.set_svg_attribute(plotting_areas, "fill", c);
  },


  /**
   * Get the SVG image's size.
   * @return {Dictionary{w,h}}  dictionary of current width (w) and height (h)
   */
  get_plot_size : function(plot_id, selector) {
    svg = (selector === undefined) ? document.getElementById(plot_id) : document.querySelector(selector);
    return {"w" : (svg.getBoundingClientRect().width) ? svg.getBoundingClientRect().width : "auto",
            "h" : (svg.getBoundingClientRect().height) ? svg.getBoundingClientRect().height : "auto"};
  },

  /**
   * Get the helpbox SVG image's size. clienthHeight of the SVG gives 0 every time but parentNode seems to work well. Difficult to debug in such an old browser. 
   * @return {Dictionary{w,h}}  dictionary of current width (w) and height (h)
   */
  get_plot_size_helpbox : function(plot_id) {
    return {"w" : (document.getElementById(plot_id).parentNode.clientWidth) ? document.getElementById(plot_id).parentNode.clientWidth : "auto",
            "h" : (document.getElementById(plot_id).parentNode.clientHeight) ? document.getElementById(plot_id).parentNode.clientHeight : "auto"};     
  },

  /**
   * Set the SVG image's size.
   * @param {String} w  The new width (follows the rules for CSS width).
   * @param {String} h  The new height (follows the rules for CSS height).
   * @return {None}
   */
  set_plot_size : function(w, h) {
    svg = document.querySelector('.adherence_plot.index' + GraphIndex);
    svg.style.width = (w === undefined) ? "auto" : w; svg.style.height = (h === undefined) ? "auto" : h; // this is special: we go for CSS attributes directly
  },

  set_plot_viewbox_width : function() {
    var svg_element = document.querySelector('.adherence_plot.index' + GraphIndex);
    svg_element.setAttribute("viewBox", adh_svg["plot" + (GraphIndex - 1) + "_size"].viewBox);
    svg_element.setAttribute("width", adh_svg["plot" + (GraphIndex - 1) + "_size"].width);
    adh_svg.set_plot_size(adh_svg["plot" + (GraphIndex - 1) + "_size"].width*1.5 + "em");
  },

  save_svg_defaults : function() {
    img_dims = adh_svg.get_plot_size(undefined, selector = '.adherence_plot.index' + GraphIndex); 
    adh_svg.default_svg_width = (img_dims.w === undefined) ? "auto" : img_dims.w; adh_svg.default_svg_height = (img_dims.h === undefined) ? "auto" : img_dims.h; // default SVG size
  },

  save_svg_interm_defaults : function() {
    img_dims = adh_svg.get_plot_size(undefined, selector = '.adherence_plot.index' + GraphIndex); 
    adh_svg.interm_default_svg_width = (img_dims.w === undefined) ? "auto" : img_dims.w; adh_svg.interm_default_svg_height = (img_dims.h === undefined) ? "auto" : img_dims.h; // interm default SVG size
  },    

  


  

  /**
   * Get font size for axis names.
   * @return {Dictionary{x,y}} the font sizes
   */
  get_font_size_axis_names : function() {
    svg = document.querySelector('.adherence_plot.index' + GraphIndex);
    ret_val = {"x":false, "y":false}; // the return value
    x = adh_svg._getElementsByClassName(svg, "axis-name-x"); ret_val["x"] = adh_svg.get_svg_attribute(x[0], "font-size");
    y = adh_svg._getElementsByClassName(svg, "axis-name-y"); ret_val["y"] = adh_svg.get_svg_attribute(y[0], "font-size");
    return ret_val;
  },

  /**
   * Set font size for axis names.
   * @param {String} sx the new font size for x axis
   * @param {String} sy the new font size for y axis
   * @return {None}
   */
  set_font_size_axis_names : function(sx, sy) {
    svg = document.querySelector('.adherence_plot.index' + GraphIndex);
    x = adh_svg._getElementsByClassName(svg, "axis-name-x"); adh_svg.set_svg_attribute(x[0], "font-size", (sx === undefined) ? adh_svg.default_font_size_axis_names["x"] : sx);
    y = adh_svg._getElementsByClassName(svg, "axis-name-y"); adh_svg.set_svg_attribute(y[0], "font-size", (sy === undefined) ? adh_svg.default_font_size_axis_names["y"] : sy);
  },


  

  /**
   * Get font size for axis labels.
   * @return {Dictionary{x,y}} the font sizes
   */
  get_font_size_axis_labels : function() {
    svg = document.querySelector('.adherence_plot.index' + GraphIndex);
    ret_val = {"x":false, "y":false}; // the return value
    x = adh_svg._getElementsByClassName(svg, "axis-labels-x"); ret_val["x"] = adh_svg.get_svg_attribute(x[0], "font-size");
    y = adh_svg._getElementsByClassName(svg, "axis-labels-y"); ret_val["y"] = adh_svg.get_svg_attribute(y[0], "font-size");
    return ret_val;
  },

  /**
   * Set font size for axis labels.
   * @param {String} sx the new font size for x axis
   * @param {String} sy the new font size for y axis
   * @return {None}
   */
  set_font_size_axis_labels : function(sx, sy) {
    svg = document.querySelector('.adherence_plot.index' + GraphIndex);
    x = adh_svg._getElementsByClassName(svg, "axis-labels-x"); adh_svg.set_svg_attribute(x, "font-size", (sx === undefined) ? adh_svg.default_font_size_axis_labels["x"] : sx);
    y = adh_svg._getElementsByClassName(svg, "axis-labels-y"); adh_svg.set_svg_attribute(y, "font-size", (sy === undefined) ? adh_svg.default_font_size_axis_labels["y"] : sy);
  },

  

  


  /**
   * Get font size for title
   * @return {Numeric} the font size
   */
/*   get_font_size_title : function() {
    svg = document.querySelector('.adherence_plot.index' + GraphIndex);
    x = adh_svg._getElementsByClassName(svg, "main-title");
    return adh_svg.get_svg_attribute(x[0], "font-size");
  }, */

  /**
   * Set font size for title
   * @param {String} s the new font size
   * @return {None}
   */
/*   set_font_size_title : function(s) {
    svg = document.querySelector('.adherence_plot.index' + GraphIndex);
    x = adh_svg._getElementsByClassName(svg, "main-title");
    adh_svg.set_svg_attribute(x, "font-size", (s === undefined) ? "16px" : s);
  }, */


  


  


  
    /**
   * Do the medication groups exist?
   * @return {Boolean} true if the medication groups exist
   */
  exists_med_groups : function() {
    svg = document.querySelector('.adherence_plot.index' + GraphIndex);
    x = adh_svg._getElementsByClassName(svg, "medication-groups-separator-hline");
    return !(!x || x.length < 1);
  },

  /**
   * Are the medication groups visible?
   * @return {Boolean} true if the medication groups are visible
   */
  is_visible_med_groups : function() {
    svg = document.querySelector('.adherence_plot.index' + GraphIndex);
    x = adh_svg._getElementsByClassName(svg, "medication-groups-separator-hline");
    if(!x || x.length < 1) return undefined;
    return adh_svg.is_visible_svg_element(x);
  },

  /**
   * Show/hide the medication groups.
   * @param {Boolean} show medication groups if true, otherwise hide them.
   * @return {None}
   */
  show_med_groups : function(show) {
    svg = document.querySelector('.adherence_plot.index' + GraphIndex);
    x_hlines = adh_svg._getElementsByClassName(svg, "medication-groups-separator-hline");
    x_vlines = adh_svg._getElementsByClassName(svg, "medication-groups-separator-vline");

    if(x_hlines) adh_svg.show_svg_element(x_hlines, show);
    if(x_vlines) adh_svg.show_svg_element(x_vlines, show);
  },

  /**
   * Are there medication classes defined?
   * @return {Boolean} true if there are medication classes, false otherwise
   */
  are_medication_classes_defined : function() {
    return (typeof adh_svg["medication_classes_Graph" + (GraphIndex - 1)] !== 'undefined');
  },

   /**
   * Are plot names defined?
   * @return {Boolean} true if there are plot names, false otherwise
   */
  are_plot_names_defined : function() {
    return (typeof adh_svg.plot_names !== 'undefined');
  },

  /**
   * Get the list of all medication classes
   * @return {Vector} the medication classes' names; null means that no classes are defined
   */
  get_medication_classes : function() {
    if( !adh_svg.are_medication_classes_defined() ) {
      return null;
    } else {
      return Object.keys(adh_svg["medication_classes_Graph" + (GraphIndex - 1)]);
    }
  }, 

  /**
   * Get the list of all plot names
   * @return {Vector} the medication classes' names; null means that no classes are defined
   */
   get_plot_names : function() {
    if( !adh_svg.are_plot_names_defined() ) {
      return null;
    } else {
      return Object.keys(adh_svg.plot_names);
    }
  },

  /* *
   * For a medication class name, get the corresponding internal id
   * @param {String} the medication class name or undefined for all classes (or no class, if classes are undefined)
   * @return {String} the medication classe id
   */
  get_id_for_medication_class : function(m) {
    if( !adh_svg.are_medication_classes_defined() || m === null || m === undefined || Array.isArray(m) ) {
      return null;
    } else {
      return adh_svg["medication_classes_Graph" + (GraphIndex - 1)][m];
    } 
  },

  /* *
   * For a plot name, get the corresponding internal id
   * @param {String} the plot name or undefined for all classes (or no class, if classes are undefined)
   * @return {String} the medication classe id
   */
   get_id_for_plot_name : function(m) {
    if( !adh_svg.are_plot_names_defined() || m === null || m === undefined || Array.isArray(m) ) {
      return null;
    } else {
      return adh_svg.plot_names[m];
    }
  },

  /**
   * Is a given medication class visible?
   * @param {String} the medication class name; null (or undefined) means there are no medication classes defined
   * @return {Boolean} true if visible
   */
  is_visible_medication_class : function(m) {
    svg = document.querySelector('.adherence_plot.index' + GraphIndex);

    if( !adh_svg.are_medication_classes_defined() ) {
      // No medication classes defined
      x_start = adh_svg._getElementsByClassName(svg, "event-start");
    } else {
      // Get the given medication class
      m_id = adh_svg.get_id_for_medication_class(m);
      if( !m_id ) return false; // cannot get the ID, so it's not visible by definition
      x_start = adh_svg._getElementsByClassName(svg, "event-start-" + m_id);
    }

    return adh_svg.is_visible_svg_element(x_start);
  }, 

  /**
   * Show/hide a given medication class.
   * @param {String} the medication class name; null (or undefined) means there are no medication classes defined
   * @param {Boolean} show  show title if true, otherwise hide it.
   * @return {None}
   */
  show_medication_class : function(m, show) {
    svg = document.querySelector('.adherence_plot.index' + GraphIndex)

    if( !adh_svg.are_medication_classes_defined() ) {
      // No medication classes defined:
      x_start = adh_svg._getElementsByClassName(svg, "event-start");
      x_end = adh_svg._getElementsByClassName(svg, "event-end");
      x_covered = adh_svg._getElementsByClassName(svg, "event-interval-covered");
      x_notcovered = adh_svg._getElementsByClassName(svg, "event-interval-not-covered");
      x_segment = adh_svg._getElementsByClassName(svg, "event-segment");
      x_dose = adh_svg._getElementsByClassName(svg, "event-dose-text");
      x_continuation = adh_svg._getElementsByClassName(svg, "continuation-line");
      x_legend_rect = adh_svg._getElementsByClassName(svg, "legend-medication-class-rect");
      x_legend_text = adh_svg._getElementsByClassName(svg, "legend-medication-class-label");
    } else {
      // Get the given medication class:
      m_id = adh_svg.get_id_for_medication_class(m);
      if( !m_id ) return false; // cannot get the ID, so it's not visible by definition
      x_start = adh_svg._getElementsByClassName(svg, "event-start-" + m_id);
      x_end = adh_svg._getElementsByClassName(svg, "event-end-" + m_id);
      x_covered = adh_svg._getElementsByClassName(svg, "event-interval-covered-" + m_id);
      x_notcovered = adh_svg._getElementsByClassName(svg, "event-interval-not-covered-" + m_id);
      x_segment = adh_svg._getElementsByClassName(svg, "event-segment-" + m_id);
      x_dose = adh_svg._getElementsByClassName(svg, "event-dose-text-" + m_id);
      x_continuation = adh_svg._getElementsByClassName(svg, "continuation-line-" + m_id);
      x_legend_rect = adh_svg._getElementsByClassName(svg, "legend-medication-class-rect-" + m_id);
      x_legend_text = adh_svg._getElementsByClassName(svg, "legend-medication-class-label-" + m_id);
    }

    var interval_check = document.querySelector('.tabcontent.graph.index' + GraphIndex + ' .button_toggle_event_intervals');
    var interval_show = show;
    if ( show && interval_check.checked === false ) interval_show = false;

    adh_svg.show_svg_element(x_start, show);
    adh_svg.show_svg_element(x_end, show);
    adh_svg.show_svg_element(x_covered, interval_show);
    adh_svg.show_svg_element(x_notcovered, interval_show);
    adh_svg.show_svg_element(x_segment, show);
    adh_svg.show_svg_element(x_dose, show);
    adh_svg.show_svg_element(x_continuation, show);

    adh_svg.set_svg_attribute(x_legend_rect, "stroke", (show === undefined || show) ? "Black" : "LightGray");
    adh_svg.set_svg_attribute(x_legend_text, "fill",   (show === undefined || show) ? "Black" : "LightGray", elem_type="font");
  },

  repopulate_medication_classes : function() {
    if (adh_svg.are_medication_classes_defined()) {
    svg = document.querySelector('.adherence_plot.index' + GraphIndex);
    m = adh_svg.get_medication_classes();
    if(m.length > 1) {
      // Hide the medication classes controls:
      tmp = document.querySelector('.tabcontent.graph.index' + GraphIndex + ' .medication_classes_div'); if(tmp) { tmp.style.display = 'block'; tmp.innerHTML = '<b>Medications: &nbsp;</b>';}

        // Check that this is a real medication class:
      if(m.length == 1 && adh_svg._getElementsByClassName(svg, "legend-medication-class-rect-" + adh_svg.get_id_for_medication_class(m[1])).length == 0) {
        // Does not seem real: keep the controls hidden (i.e., do nothing)
      } else
      {
      // Iterate through all medication classes:
      for(i=0; i<m.length; i++) {
        l_rect = adh_svg._getElementsByClassName(svg, "legend-medication-class-rect-" + adh_svg.get_id_for_medication_class(m[i]));
        for(j=0; j<l_rect.length; j++) {
          l_rect[j].style.cursor = "pointer";
          l_rect[j].addEventListener("click", (function(x){ return function() { adh_svg.show_medication_class(x, !adh_svg.is_visible_medication_class(x)); tmp = document.querySelector('.tabcontent.graph.index' + GraphIndex + ' #button_toggle_class_' + adh_svg.get_id_for_medication_class(x)); if(tmp) { tmp.checked = !tmp.checked; } }; })(m[i]), false);
        }
        l_label = adh_svg._getElementsByClassName(svg, "legend-medication-class-label-" + adh_svg.get_id_for_medication_class(m[i]));
        for(j=0; j<l_label.length; j++) {
          l_label[j].style.cursor = "pointer";
          l_label[j].addEventListener("click", (function(x){ return function() { adh_svg.show_medication_class(x, !adh_svg.is_visible_medication_class(x)); tmp = document.querySelector('.tabcontent.graph.index' + GraphIndex + ' #button_toggle_class_' + adh_svg.get_id_for_medication_class(x)); if(tmp) { tmp.checked = !tmp.checked; } }; })(m[i]), false);
        }
        // Add the HTML elements as well:
        node = document.createElement('span'); // the contaning <span>
        node.title = "Show/hide " + m[i]; // the tooltip (title)
        var is_checked = adh_svg.is_visible_medication_class(m[i]) ? "checked": "unchecked";
        node.innerHTML = '<label id="label_toggle_class_' + adh_svg.get_id_for_medication_class(m[i]) + '"><input id="button_toggle_class_' + adh_svg.get_id_for_medication_class(m[i]) + '" type="checkbox" onclick=\'adh_svg.show_medication_class("' + m[i] + '", !adh_svg.is_visible_medication_class("' + m[i] + '"))\' ' + is_checked + '>' + m[i] + '</label> &nbsp;'; // the HTML content
        tmp.appendChild(node); // ad it to the document
      }
      }
    } else
    {
      // Hide the medication classes controls:
      tmp = document.querySelector('.tabcontent.graph.index' + GraphIndex + ' .medication_classes_div'); if(tmp) { tmp.style.display = 'none'; }
    };
    }
  },
  
  show_all_medication_classes : function() {
    m = adh_svg.get_medication_classes();
    if(m) {
      for(z=0; z<m.length; z++) {
        adh_svg.show_medication_class(m[z], true);
      }
    }
  },

  show_tooltip : function(evt, text) {
    var tooltip = document.getElementById("tooltip");
    tooltip.innerHTML = text;
    tooltip.style.display = "block";
    tooltip.style.left = evt.pageX + 10 + 'px';
    tooltip.style.top = evt.pageY + 10 + 'px';
  },

  hide_tooltip : function() {
      var tooltip = document.getElementById("tooltip");
      tooltip.style.display = "none";
  }, 

  change_tab: function(evt, tab) {
    // Declare all variables
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = adh_svg._getElementsByClassName(document, "tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = adh_svg._getElementsByClassName(document, "tablink");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].classList.remove("active");
    }
    
    // Show the current tab, and add an "active" class to the button that opened the tab
    //document.getElementById(tab).style.display = "block";
    document.querySelector('.tabcontent.'+tab+'.index'+GraphIndex).style.display = "block";
    if (evt) {
      evt.currentTarget.classList.add("active");
    };
  },

  search_data_table: function() {
      var i, j;
      var input = document.querySelector('.datatable_search_input.index' + GraphIndex)
      var filter = input.value.toUpperCase();
      var table = document.getElementById("table" + (GraphIndex-1));
      var tr = table.getElementsByTagName("tr");
    for (i = 1; i < tr.length; i++) {
      tr[i].style.display = "none";
      var td = tr[i].getElementsByTagName("td");
      for (j = 0; j < td.length; j++) {
        cell = tr[i].getElementsByTagName("td")[j];
        if (cell) {
          if (cell.innerHTML.toUpperCase().indexOf(filter) > -1) {
            tr[i].style.display = "";
            break;
          } 
        }
      }       
    }
  },

  clear_input_box: function() {
    var input = document.querySelector('.datatable_search_input.index' + GraphIndex)
    input.value = "";
    adh_svg.search_data_table();
  },

  disable_graph_buttons: function() {
    var disable_ids = document.querySelectorAll(".button_image_size_default, .button_image_size_increase, .button_image_size_decrease");
    for (i=0; i < disable_ids.length; i++) {
      disable_ids[i].disabled = true;
    }
  },

  enable_graph_buttons: function() {
    var enable_ids = document.querySelectorAll(".button_image_size_default, .button_image_size_increase, .button_image_size_decrease");
    for (i=0; i < enable_ids.length; i++) {
      enable_ids[i].disabled = false;
    }
  },

  actual_svg_position: function(event) {
    var svgDiv = document.querySelector('.svg_image_div.index' + GraphIndex);
    var svgPlot = document.querySelector('.adherence_plot.index' + GraphIndex);
    var viewboxDetails = svgPlot.viewBox.baseVal;
    var currentPlotSize = adh_svg.get_plot_size(undefined, selector = '.adherence_plot.index' + GraphIndex);

    var xMult = viewboxDetails.width / currentPlotSize.w;
    var yMult = viewboxDetails.height / currentPlotSize.h;
    var x = (event.pageX - svgDiv.offsetLeft + svgDiv.scrollLeft) * xMult;
    var y = (event.pageY - svgDiv.offsetTop + svgDiv.scrollTop) * yMult;

    return { "x" : x,
             "y" : y}
  },

  set_relative_svg_help_position: function(left, top, visible, info_id) {

    var svgDiv = document.getElementById("svg_help_div");
    var svgPlot = document.getElementById("help_plot");
    var viewboxDetails = svgPlot.viewBox.baseVal;
    var currentPlotSize = adh_svg.get_plot_size_helpbox("help_plot");

    var xMult = viewboxDetails.width / currentPlotSize.w;
    var yMult = viewboxDetails.height / currentPlotSize.h;
    var x = (left / xMult); 
    var y = (top / yMult); 
    var infobox = document.getElementById(info_id)
    if (visible == true) {
        infobox.style.display = "block";
        infobox.style.left = x + "px";
        infobox.style.top = y + "px";                   
    } else {
        infobox.style.display = "none";
    }

  }

}; // end namespace

// functions for flicking through help images
var help_graph_number = 1

function help_graph() {

  var pause_play_button = document.getElementById("pauseplay");
  
  var SVGHelpSelected = document.getElementById("SVGSelectedHelp");
  SVGHelpSelected.removeChild(SVGHelpSelected.firstChild);
  var use_element = document.createElementNS("http://www.w3.org/2000/svg",'use');
  use_element.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", '#helpplot' + help_graph_number);
  SVGHelpSelected.appendChild(use_element);
  
  switch(help_graph_number) {
      case 1:
          adh_svg.set_relative_svg_help_position(250.949, 150, true, "helpbox1");
          adh_svg.set_relative_svg_help_position(480, 140, false, "helpbox2");
          adh_svg.set_relative_svg_help_position(400, 100, false, "helpbox3");
          adh_svg.set_relative_svg_help_position(450, 100, false, "helpbox4");
          break;
      case 2: 
          adh_svg.set_relative_svg_help_position(200, 100, false, "helpbox1");
          adh_svg.set_relative_svg_help_position(490, 135, true, "helpbox2");
          adh_svg.set_relative_svg_help_position(400, 100, false, "helpbox3");
          adh_svg.set_relative_svg_help_position(450, 100, false, "helpbox4");
          break;
      case 3:
          adh_svg.set_relative_svg_help_position(200, 100, false, "helpbox1");
          adh_svg.set_relative_svg_help_position(300, 100, false, "helpbox2");
          adh_svg.set_relative_svg_help_position(194.282, 105, true, "helpbox3");
          adh_svg.set_relative_svg_help_position(450, 100, false, "helpbox4");
          break; 
      case 4:
          adh_svg.set_relative_svg_help_position(200, 100, false, "helpbox1");
          adh_svg.set_relative_svg_help_position(300, 100, false, "helpbox2");
          adh_svg.set_relative_svg_help_position(194.282, 105, false, "helpbox3");
          adh_svg.set_relative_svg_help_position(479.949, 59, true, "helpbox4");
          break;      
      default:
          adh_svg.set_relative_svg_help_position(200, 100, false, "helpbox1");
          adh_svg.set_relative_svg_help_position(300, 100, false, "helpbox2");
          adh_svg.set_relative_svg_help_position(400, 100, false, "helpbox3");
          adh_svg.set_relative_svg_help_position(450, 100, false, "helpbox4");
  }
  
  if (pause_play_button.classList.contains("automatic")) {
      if (help_graph_number==4) {
          help_graph_number=1
      } else {
          help_graph_number=help_graph_number+1
      };
  };
}

var change_plot;

// Other functions used for HTML interactions

// Change the SVG image size up and down by a given multiplier:
function image_change_size(ds) {
  img_dims = adh_svg.get_plot_size(undefined, selector = '.adherence_plot.index' + GraphIndex); // get the current image dimensions

  new_w = img_dims.w * ds; new_h = img_dims.h * ds; // the new size
  if(new_w < 1 || new_h < 1) return; // can't go below 1!

  adh_svg.set_plot_size(new_w + 'px', new_h + 'px'); // set the new dimension
}


// Initialisation stuff:
window.onload = function() {

  // Check if browser supports embedded SVG:
  if(!adh_svg.is_embedded_SVG_supported()) {
    alert("It appears your browser does not support svg image files. Please use a modern browser or, if using IE9 ensure you are not in compatability mode. If changing browser is not an option please contact David Fyfe at david.fyfe@ggc.scot.nhs.uk");
  }

  var sidebar_names = Object.keys(adh_svg.plot_names);
  for (i=0; i < sidebar_names.length; i++) {
    var sidebar_list = document.getElementById("sidebar_list");
    list_element = document.createElement("li");
    list_element.innerHTML = '<a href="#" class="navpage"><span>' + sidebar_names[i] + '</span></a>';
    sidebar_list.appendChild(list_element);
  } 

  // Show or hide the AdhereR logo controlled via the AdhereR package
  //<!--Hide logo placeholder-->

  var graph_buttons = document.querySelectorAll('.tablink.button_graph');
  for (i=0; i<graph_buttons.length; i++) {
    //graph_buttons[i].addEventListener('click', adh_svg.save_svg_defaults, false);
    graph_buttons[i].addEventListener('click', adh_svg.enable_graph_buttons, false);
    graph_buttons[i].addEventListener('click', function(e) {adh_svg.change_tab(e, 'graph')}, false);
  };

  var table_buttons = document.querySelectorAll('.tablink.button_data');
  for (i=0; i<table_buttons.length; i++) {
    table_buttons[i].addEventListener('click', adh_svg.disable_graph_buttons, false);
    table_buttons[i].addEventListener('click', function(e) {adh_svg.change_tab(e, 'table')}, false);
  }

  // The FUW (if any):
  l_rect = adh_svg._getElementsByClassName(document, "legend-fuw-rect");
  for(j=0; j<l_rect.length; j++) {
    l_rect[j].style.cursor = "pointer";
    l_rect[j].addEventListener("click", function(e){ adh_svg.show_fuw(!adh_svg.is_visible_fuw()); tmp = document.querySelector('.tabcontent.graph.index' + GraphIndex + ' .button_toggle_fuw'); if(tmp) { tmp.checked = !tmp.checked; } }, false);
  }
  l_label = adh_svg._getElementsByClassName(document, "legend-fuw-label");
  for(j=0; j<l_label.length; j++) {
    l_label[j].style.cursor = "pointer";
    l_label[j].addEventListener("click", function(e){ adh_svg.show_fuw(!adh_svg.is_visible_fuw()); tmp = document.querySelector('.tabcontent.graph.index' + GraphIndex + ' .button_toggle_fuw'); if(tmp) { tmp.checked = !tmp.checked; } }, false);
  }
  // The OW (if any):
  l_rect = adh_svg._getElementsByClassName(document, "legend-ow-rect");
  for(j=0; j<l_rect.length; j++) {
    l_rect[j].style.cursor = "pointer";
    l_rect[j].addEventListener("click", function(e){ adh_svg.show_ow(!adh_svg.is_visible_ow()); tmp = document.querySelector('.tabcontent.graph.index' + GraphIndex + ' .button_toggle_ow'); if(tmp) { tmp.checked = !tmp.checked; } }, false);
  }
  l_label = adh_svg._getElementsByClassName(document, "legend-ow-label");
  for(j=0; j<l_label.length; j++) {
    l_label[j].style.cursor = "pointer";
    l_label[j].addEventListener("click", function(e){ adh_svg.show_ow(!adh_svg.is_visible_ow()); tmp = document.querySelector('.tabcontent.graph.index' + GraphIndex + ' .button_toggle_ow'); if(tmp) { tmp.checked = !tmp.checked; } }, false);
  }
  // The "real" OW [CMA8] (if any):
  l_rect = adh_svg._getElementsByClassName(document, "legend-ow-real-rect");
  for(j=0; j<l_rect.length; j++) {
    l_rect[j].style.cursor = "pointer";
    l_rect[j].addEventListener("click", function(e){ adh_svg.show_ow_real(!adh_svg.is_visible_ow_real()); tmp = document.querySelector('.tabcontent.graph.index' + GraphIndex + ' .button_toggle_ow_real'); if(tmp) { tmp.checked = !tmp.checked; } }, false);
  }
  l_label = adh_svg._getElementsByClassName(document, "legend-ow-real-label");
  for(j=0; j<l_label.length; j++) {
    l_label[j].style.cursor = "pointer";
    l_label[j].addEventListener("click", function(e){ adh_svg.show_ow_real(!adh_svg.is_visible_ow_real()); tmp = document.querySelector('.tabcontent.graph.index' + GraphIndex + ' .button_toggle_ow_real'); if(tmp) { tmp.checked = !tmp.checked; } }, false);
  }

  var plots = document.querySelectorAll('.adherence_plot');
  for (i=0; i<plots.length; i++) {
  plots[i].addEventListener('mousedown', function(e) {
    var svg = document.querySelector('.adherence_plot.index' + GraphIndex);

    if (svg.classList.contains("zoomed")) {
        return;
    };

    adh_svg.save_svg_interm_defaults();

    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    var start = adh_svg.actual_svg_position(e);
    

    var drawRect = function(e) {
        var p = adh_svg.actual_svg_position(e);
        var w = Math.abs(p.x - start.x);
        var h = Math.abs(p.y - start.y);
        if (p.x > start.x) {
          p.x = start.x;
        }

        if (p.y > start.y) {
          p.y = start.y;
        }

        rect.setAttributeNS(null, 'x', p.x);
        rect.setAttributeNS(null, 'y', p.y);
        rect.setAttributeNS(null, 'width', w);
        rect.setAttributeNS(null, 'height', h);
        rect.setAttributeNS(null, 'class', "zoomBox");
        svg.appendChild(rect);

        adh_svg["viewboxRect"] = { "x" : p.x,
                                   "y" : p.y,
                                   "w" : w,
                                   "h" : h}
    }            

    var endDraw = function(e) {
        svg.removeEventListener('mousemove', drawRect, false);
        svg.removeEventListener('mouseup', endDraw, false);
    }
    
    svg.addEventListener('mousemove', drawRect, false);
    svg.addEventListener('mouseup', endDraw, false);

  }, false)

  plots[i].addEventListener('mouseup', function(e) {
      var svg = document.querySelector('.adherence_plot.index' + GraphIndex);

      svg.setAttribute("viewBox", adh_svg["viewboxRect"].x +" "+ adh_svg["viewboxRect"].y +" "+ adh_svg["viewboxRect"].w +" "+ adh_svg["viewboxRect"].h);
      svg.style.height = "auto";
      svg.classList.add("zoomed");

      var elements = adh_svg._getElementsByClassName(svg, "zoomBox");
      while(elements.length > 0){
          elements[0].parentNode.removeChild(elements[0]);
      };

  }, false)
  }

  var zooms = document.querySelectorAll('.reset_zoom');
  for (i=0; i<zooms.length; i++) {
  zooms[i].addEventListener('click', function(event) {
    var svg = document.querySelector('.adherence_plot.index' + GraphIndex);
    svg.classList.remove("zoomed");
    adh_svg.set_plot_size(adh_svg.interm_default_svg_width+"px", adh_svg.interm_default_svg_height+"px");
    svg.setAttribute("viewBox", adh_svg["plot" + (GraphIndex - 1) + "_size"].viewBox);

  }, false)
  }

  document.getElementById("pauseplay").addEventListener('click' , function(e) {
    var pause_play_button = document.getElementById("pauseplay");
    
    if (pause_play_button.classList.contains("automatic")) {
        clearInterval(change_plot);
        if (help_graph_number==1) {
            help_graph_number=4
        } else {
            help_graph_number=help_graph_number-1
        };
        pause_play_button.classList.remove("automatic");
        pause_play_button.classList.add("manual");
        pause_play_button.innerHTML = "&#9654";
    } else {
        pause_play_button.classList.remove("manual");
        pause_play_button.classList.add("automatic");
        pause_play_button.innerHTML = "||";
        if (help_graph_number==4) {
            help_graph_number=1
        } else {
            help_graph_number=help_graph_number+1
        };
        change_plot = setInterval(help_graph, 3000);
    }
  }, false)

  document.getElementById("back").addEventListener('click' , function(e) {
      var pause_play_button = document.getElementById("pauseplay");
      
      if (pause_play_button.classList.contains("automatic")) {
          clearInterval(change_plot);
          if (help_graph_number==1) {
              help_graph_number=4
          } else {
              help_graph_number=help_graph_number-1
          };
          pause_play_button.classList.remove("automatic");
          pause_play_button.classList.add("manual");
          pause_play_button.innerHTML = "&#9654";
      }

      if (help_graph_number==1) {
          help_graph_number=4
      } else {
          help_graph_number=help_graph_number-1
      };
      help_graph();
  }, false)

document.getElementById("forward").addEventListener('click' , function(e) {
    var pause_play_button = document.getElementById("pauseplay");
    
    if (pause_play_button.classList.contains("automatic")) {
        clearInterval(change_plot);
        if (help_graph_number==1) {
            help_graph_number=4
        } else {
            help_graph_number=help_graph_number-1
        };
        pause_play_button.classList.remove("automatic");
        pause_play_button.classList.add("manual");
        pause_play_button.innerHTML = "&#9654";
    }

    if (help_graph_number==4) {
        help_graph_number=1
    } else {
        help_graph_number=help_graph_number+1
    };
    help_graph();
}, false)

var menu_toggle = document.querySelector(".menu_toggle");
menu_toggle.addEventListener('click', function(){
    document.querySelector("body").classList.toggle("active");
}, false)

var show_hide_buttons =document.querySelectorAll(".show_hide_controls");
for (i = 0; i < show_hide_buttons.length; i++) {
  show_hide_buttons[i].addEventListener('click', function(){
    var controls_div = document.querySelector(".tabcontent.graph.index" + GraphIndex + " .svg_controls");
    var svgDiv = document.querySelector(".tabcontent.graph.index" + GraphIndex + " .svg_image_div")

    if ( controls_div.classList.contains("active")) {
      controls_div.classList.remove("active");
      svgDiv.style.height = window.innerHeight - 170;
    } else {
      controls_div.classList.add("active");
      svgDiv.style.height = window.innerHeight - controls_div.offsetHeight - 170;
    };
  }, false)
}

var list_items = document.querySelectorAll(".wrapper .sidebar ul li a");
for (i = 0; i < list_items.length; i++) {
  list_items[i].addEventListener('click', function(e){
    
    var plots = document.querySelectorAll('.adherence_plot');
    for (i=0; i < plots.length; i++) {
      plots[i].classList.remove('zoomed');
    };

    var list_items = document.querySelectorAll(".wrapper .sidebar ul li a");
    var tab_items = document.querySelectorAll(".wrapper .section .tabcontent-main .tab-pane")
    
    for (i = 0; i < list_items.length; i++) {
      list_items[i].classList.remove("active"); 
      tab_items[i].classList.remove("active");
    };
    
    e.currentTarget.classList.add("active");
    
    for (i = 0; i < list_items.length; i++) {
      if(list_items[i].classList.contains("active")) {
        GraphIndex = i
      };   
    };

    document.querySelector(".wrapper .section .tabcontent-main .tab-pane.index" + GraphIndex).classList.add("active");

    if (list_items[GraphIndex].classList.contains("navpage_help")) {
      help_graph_number = 1;
      
      var pause_play_button = document.getElementById("pauseplay");
      if (pause_play_button.classList.contains("manual")) {
        pause_play_button.classList.remove("manual");
        pause_play_button.classList.add("automatic");
        pause_play_button.innerHTML = "||";
      };
      
      help_graph();
      change_plot = setInterval(help_graph, 3000);
    } else {
      clearInterval(change_plot);
    };

    var tabcontent = document.querySelectorAll('.tabcontent');
    for (i=0; i<tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }

    var tablinks = document.querySelectorAll('.tablink');
    for (i=0; i<tablinks.length; i++) {
      tablinks[i].classList.remove("active");
      tablinks[i].style.display = "";
    }

    var graph_div = document.querySelectorAll('.tabcontent.graph');
    if (GraphIndex > 1) {
      graph_div[GraphIndex-2].style.display = "block";
    };
    
    var graph_button = document.querySelectorAll('.tablink.button_graph');
    if (GraphIndex > 1) {
      graph_button[GraphIndex-2].classList.add("active");
    };

    adh_svg.enable_graph_buttons();

    if(document.querySelector('.tab-pane.index'+GraphIndex+'.active .tabcontent table') == null) {
      var tablinks = document.querySelectorAll('.tablink');
      for (i=0; i<tablinks.length; i++) {
        tablinks[i].style.display = "none";
      }
    };

    if (GraphIndex > 1) {
      
      adh_svg.repopulate_medication_classes();
      
      // Save default values so we are able to restore them later if need be:
      tmp = document.querySelector(".button_toggle_alt_bands");
      adh_svg.label_style_default = tmp ? tmp.style : "none"; // save the default lablel CSS style
      adh_svg.label_style_disabled = "color: #aaa;" // and this is the disabled lable look
      img_dims = adh_svg.get_plot_size(undefined, selector = '.adherence_plot.index' + GraphIndex); adh_svg.default_svg_width = (img_dims.w === undefined) ? "auto" : img_dims.w; adh_svg.default_svg_height = (img_dims.h === undefined) ? "auto" : img_dims.h; // default SVG size
      //adh_svg.default_font_size_title = adh_svg.get_font_size_title(); // default title font sizes
      adh_svg.default_font_size_axis_names = adh_svg.get_font_size_axis_names(); // default axes names font sizes
      adh_svg.default_font_size_axis_labels = adh_svg.get_font_size_axis_labels(); // default axes labels font sizes

      // (Un)check and (dis)able various components in the HTML document
      // the idea is to disable the check button and the label if the element does not exist in the SVG, and to enable it if the element exists and is visible...


      if(adh_svg.exists_med_groups()) {
        tmp = document.querySelector('.tabcontent.graph.index' + GraphIndex + ' .button_toggle_med_groups'); if(tmp) { tmp.disabled = false; tmp.checked = adh_svg.is_visible_med_groups(); }
        tmp = document.querySelector('.tabcontent.graph.index' + GraphIndex + ' .label_toggle_med_groups'); if(tmp) { tmp.disabled = false; tmp.style = adh_svg.label_style_default; }
      } else {
        tmp = document.querySelector('.tabcontent.graph.index' + GraphIndex + ' .button_toggle_med_groups'); if(tmp) { tmp.disabled = true; tmp.checked = false; }
        tmp = document.querySelector('.tabcontent.graph.index' + GraphIndex + ' .label_toggle_med_groups'); if(tmp) { tmp.disabled = true; tmp.style = adh_svg.label_style_disabled; }
      };

      // The initial SVG size is in terms of "standard" characters: rescale it as 1 "standard" character -> 1.5em:
      adh_svg.set_plot_viewbox_width();
      img_dims = adh_svg.get_plot_size(undefined, selector = '.adherence_plot.index' + GraphIndex); adh_svg.default_svg_width = (img_dims.w === undefined) ? "auto" : img_dims.w; adh_svg.default_svg_height = (img_dims.h === undefined) ? "auto" : img_dims.h; // default SVG size

    }
  }, false);

  
}

var event_intervals = document.querySelectorAll(".event-interval-covered, .event-interval-not-covered");  
adh_svg.show_svg_element(event_intervals, false);
document.querySelectorAll(".wrapper .sidebar ul li a")[2].click();

}


