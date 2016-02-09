/**
 * @file
 * Defines the behaviors needed for cropper integration.
 */

(function ($, Drupal, drupalSettings) {
  'use strict';

  var cropperSelector = '.crop-preview-wrapper__preview-image';
  var cropperValuesSelector = '.crop-preview-wrapper__value';
  var cropWrapperSelector = '.image-widget-data__crop-wrapper';
  var cropWrapperSummarySelector = 'summary';
  var verticalTabsSelector = '.vertical-tabs';
  var verticalTabsMenuItemSelector = '.vertical-tabs__menu-item';
  var resetSelector = '.crop-preview-wrapper__crop-reset';
  var detailsWrapper = '.details-wrapper';
  var detailsParentSelector = '.image-widget-data';
  var table = '.responsive-enabled';
  var cropperOptions = {
    background: false,
    zoomable: false,
    viewMode: 1,
    autoCropArea: 1,
    responsive: false,
    // Callback function, fires when crop is applied.
    cropend: function (e) {
      var $this = $(this);
      var $values = $this.siblings(cropperValuesSelector);
      var data = $this.cropper('getData');
      // Calculate delta between original and thumbnail images.
      var delta = $this.data('original-height') / $this.prop('naturalHeight');
      /*
       * All data returned by cropper plugin multiple with delta in order to get
       * proper crop sizes for original image.
       */
      $values.find('.crop-x').val(Math.round(data.x * delta));
      $values.find('.crop-y').val(Math.round(data.y * delta));
      $values.find('.crop-width').val(Math.round(data.width * delta));
      $values.find('.crop-height').val(Math.round(data.height * delta));
      $values.find('.crop-applied').val(1);
      Drupal.imageWidgetCrop.updateCropSummaries($this);
    }
  };

  Drupal.imageWidgetCrop = {};

  /**
   * Initialize cropper on the ImageWidgetCrop widget.
   *
   * @param {Object} context - Element to initialize cropper on.
   */
  Drupal.imageWidgetCrop.initialize = function (context) {
    var $cropWrapper = $(cropWrapperSelector, context);
    var $cropWrapperSummary = $cropWrapper.children(detailsWrapper).find(cropWrapperSummarySelector);
    var $verticalTabs = $(verticalTabsSelector, context);
    var $verticalTabsMenuItem = $verticalTabs.find(verticalTabsMenuItemSelector);
    var $reset = $(resetSelector, context);

    /*
     * Cropper initialization on click events on vertical tabs and details
     * summaries (for smaller screens).
     */
    $verticalTabsMenuItem.add($cropWrapperSummary).click(function () {
      var tabId = $(this).find('a').attr('href');
      var $cropper = $(this).parent().find(cropperSelector);
      if(typeof tabId !== 'undefined') {
        $cropper = $(tabId).find(cropperSelector);
      }
      var ratio = Drupal.imageWidgetCrop.getRatio($cropper);
      Drupal.imageWidgetCrop.initializeCropper($cropper, ratio);
    });

    // Handling click event for opening/closing vertical tabs.
    $cropWrapper.children(cropWrapperSummarySelector).click(function (evt) {
      // Work only on bigger screens where $verticalTabsMenuItem is not empty.
      if($verticalTabsMenuItem.length !== 0) {
        // If detailsWrapper is not visible display it and initialize cropper.
        if( !$(this).siblings(detailsWrapper).is(':visible') ) {
          evt.preventDefault();
          $(this).parent().attr('open','open');
          $(table).addClass('responsive-enabled--opened');
          $(this).parent().find(detailsWrapper).show();
          Drupal.imageWidgetCrop.initializeCropperOnChildren($(this).parent());
          evt.stopImmediatePropagation();
        }
        // If detailsWrapper is visible hide it.
        else {
          $(this).parent().removeAttr('open');
          $(table).removeClass('responsive-enabled--opened');
          $(this).parent().find(detailsWrapper).hide();
        }
      }
    });

    $reset.on('click', function (e) {
      e.preventDefault();
      var $element = $(this).siblings(cropperSelector);
      Drupal.imageWidgetCrop.reset($element);
      return false;
    });

    // Handling croping when viewport resizes.
    $(window).resize(function() {
      $(detailsParentSelector).each(function() {
        // Find only opened widgets.
        var cropperDetailsWrapper = $(this).children('details[open="open"]');
        cropperDetailsWrapper.each(function() {
          // Find all croppers for opened widgets.
          var $croppers = $(this).find(cropperSelector);
          $croppers.each(function () {
            if($(this).parent().parent().parent().css('display') !== 'none') {
              // Get previous data for cropper.
              var canvasDataOld = $(this).cropper('getCanvasData');
              var cropBoxData = $(this).cropper('getCropBoxData');

              // Re-render cropper.
              $(this).cropper('render');

              // Get new data for cropper and calculate resize ratio.
              var canvasDataNew = $(this).cropper('getCanvasData');
              var ratio = 1;
              if (canvasDataOld.width !== 0) {
                ratio = canvasDataNew.width / canvasDataOld.width;
              }

              // Set new data for crop box.
              $.each(cropBoxData, function (index, value) {
                cropBoxData[index] = value * ratio;
              });
              $(this).cropper('setCropBoxData', cropBoxData);
            }
          });
        });
      });
    });

    // Correctly updating messages of summaries.
    Drupal.imageWidgetCrop.updateAllCropSummaries();
  };

  /**
   * Get ratio data and determine if an available ratio or free crop.
   *
   * @param {Object} $element - Element to initialize cropper on its children.
   */
  Drupal.imageWidgetCrop.getRatio = function ($element) {
    var ratio = $element.data('ratio');
    var regex = /:/;

    if ((regex.exec(ratio)) !== null) {
      var int = ratio.split(":");
      if ($.isArray(int) && ($.isNumeric(int[0]) && $.isNumeric(int[1]))) {
        return int[0] / int[1];
      } else {
        return "NaN";
      }
    } else {
      return ratio;
    }
  };

  /**
   * Initialize cropper on an element.
   *
   * @param {Object} $element - Element to initialize cropper on.
   * @param {number} ratio - The ratio of the image.
   */
  Drupal.imageWidgetCrop.initializeCropper = function ($element, ratio) {
    var data = null;
    var $values = $element.siblings(cropperValuesSelector);

    //Calculate minimal height for cropper container (minimal width is 200).
    var minDelta = ( $element.data('original-width') / 200 );
    cropperOptions['minContainerHeight'] = $element.data('original-height') / minDelta;

    var options = cropperOptions;
    var delta = $element.data('original-height') / $element.prop('naturalHeight');

    // If 'Show default crop' is checked show crop box.
    options.autoCrop = drupalSettings['crop_default'];

    if (parseInt($values.find('.crop-applied').val()) === 1) {
      data = {
        x: Math.round(parseInt($values.find('.crop-x').val()) / delta),
        y: Math.round(parseInt($values.find('.crop-y').val()) / delta),
        width: Math.round(parseInt($values.find('.crop-width').val()) / delta),
        height: Math.round(parseInt($values.find('.crop-height').val()) / delta),
        rotate: 0,
        scaleX: 1,
        scaleY: 1
      };
      options.autoCrop = true;
    }

    options.data = data;
    options.aspectRatio = ratio;

    $element.cropper(options);

    // If 'Show default crop' is checked apply default crop.
    if(drupalSettings['crop_default']) {
      var dataDefault = $element.cropper('getData');
      // Calculate delta between original and thumbnail images.
      var deltaDefault = $element.data('original-height') / $element.prop('naturalHeight');
      /*
       * All data returned by cropper plugin multiple with delta in order to get
       * proper crop sizes for original image.
       */
      Drupal.imageWidgetCrop.updateCropValues($values, dataDefault, deltaDefault);
      Drupal.imageWidgetCrop.updateCropSummaries($element);
    }
  };

  /**
   * Update crop values in hidden inputs.
   *
   * @param {Object} $element - Cropper values selector.
   * @param {Array} $data - Cropper data.
   * @param {number} $delta - Delta between original and thumbnail images.
   */
  Drupal.imageWidgetCrop.updateCropValues = function ($element, $data, $delta) {
    $element.find('.crop-x').val(Math.round($data.x * $delta));
    $element.find('.crop-y').val(Math.round($data.y * $delta));
    $element.find('.crop-width').val(Math.round($data.width * $delta));
    $element.find('.crop-height').val(Math.round($data.height * $delta));
    $element.find('.crop-applied').val(1);
  };

  /**
   * Initialize cropper on all children of an element.
   *
   * @param {Object} $element - Element to initialize cropper on its children.
   */
  Drupal.imageWidgetCrop.initializeCropperOnChildren = function ($element) {
    var visibleCropper = $element.find(cropperSelector + ':visible');
    var ratio = Drupal.imageWidgetCrop.getRatio($(visibleCropper));
    Drupal.imageWidgetCrop.initializeCropper($(visibleCropper), ratio);
  };

  /**
   * Update single crop summary of an element.
   *
   * @param {Object} $element - The element cropping on which has been changed.
   */
  Drupal.imageWidgetCrop.updateSingleCropSummary = function ($element) {
    var $values = $element.siblings(cropperValuesSelector);
    var croppingApplied = parseInt($values.find('.crop-applied').val());

    $element.closest('details').drupalSetSummary(function (context) {
      if (croppingApplied === 1) {
        return Drupal.t('Cropping applied');
      }
    });
  };

  /**
   * Update common crop summary of an element.
   *
   * @param {Object} $element - The element cropping on which has been changed.
   */
  Drupal.imageWidgetCrop.updateCommonCropSummary = function ($element) {
    var croppingApplied = parseInt($element.find('.crop-applied[value="1"]').length);
    var wrapperText = Drupal.t('Crop image');
    if (croppingApplied) {
      wrapperText = Drupal.t('Crop image (cropping applied)');
    }
    $element.children('summary').text(wrapperText);
  };

  /**
   * Update crop summaries after cropping cas been set or reset.
   *
   * @param {Object} $element - The element cropping on which has been changed.
   */
  Drupal.imageWidgetCrop.updateCropSummaries = function ($element) {
    var $details = $element.closest('details' + cropWrapperSelector);
    Drupal.imageWidgetCrop.updateSingleCropSummary($element);
    Drupal.imageWidgetCrop.updateCommonCropSummary($details);
  };

  /**
   * Update crop summaries of all elements.
   */
  Drupal.imageWidgetCrop.updateAllCropSummaries = function () {
    var $croppers = $(cropperSelector);
    $croppers.each(function () {
      Drupal.imageWidgetCrop.updateSingleCropSummary($(this));
    });
    var $cropWrappers = $(cropWrapperSelector);
    $cropWrappers.each(function () {
      Drupal.imageWidgetCrop.updateCommonCropSummary($(this));
    });
  };

  /**
   * Reset cropping for an element.
   *
   * @param {Object} $element - The element to reset cropping on.
   */
  Drupal.imageWidgetCrop.reset = function ($element) {
    var $valuesDefault = $element.siblings(cropperValuesSelector);
    var options = cropperOptions;
    // If 'Show default crop' is not checked re-initialize cropper.
    if(!drupalSettings['crop_default']) {
      $element.cropper('destroy');
      options.autoCrop = false;
      $element.cropper(options);
      $valuesDefault.find('.crop-applied').val(0);
      $valuesDefault.find('.crop-x').val('');
      $valuesDefault.find('.crop-y').val('');
      $valuesDefault.find('.crop-width').val('');
      $valuesDefault.find('.crop-height').val('');
    }
    else {
      // Reset cropper.
      $element.cropper('reset').cropper('options', options);
      var dataDefault = $element.cropper('getData');
      // Calculate delta between original and thumbnail images.
      var deltaDefault = $element.data('original-height') / $element.prop('naturalHeight');
      /*
       * All data returned by cropper plugin multiple with delta in order to get
       * proper crop sizes for original image.
       */
      Drupal.imageWidgetCrop.updateCropValues($valuesDefault, dataDefault, deltaDefault);
    }
    Drupal.imageWidgetCrop.updateCropSummaries($element);
  };

  Drupal.behaviors.imageWidgetCrop = {
    attach: function (context) {
      Drupal.imageWidgetCrop.initialize(context);
      Drupal.imageWidgetCrop.updateAllCropSummaries();
    }
  };

}(jQuery, Drupal, drupalSettings));
