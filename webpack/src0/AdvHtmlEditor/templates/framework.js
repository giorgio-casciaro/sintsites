var framework = {
  states: {
    base: {
      name: 'Normal',
      description: 'Element initial state'
    },
    phones_v: {
      name: 'Phones Vertical',
      description: 'Phones Vertical description'
    },
    phones_o: {
      name: 'Phones Horizontal',
      description: 'Phones Horizontal description'
    },
    tablets_v: {
      name: 'Tablets Vertical',
      description: 'Tablets description'
    },
    tablets_o: {
      name: 'Tablets Horizontal',
      description: 'Tablets Horizontal description'
    },
    desktop: {
      name: 'Desktop',
      description: 'Desktop description'
    }
  },
  classes: {
    importance: {
      name: 'importance',
      description: 'importance',
      classes: {
        primary: {
          name: 'primary',
          description: 'primary',
          css: 'color: #fff; background-color: #007bff;'
        },
        secondary: {
          name: 'secondary',
          description: 'secondary',
          css: 'color: #fff; background-color: #6c757d'
        },
        success: {
          name: 'success',
          description: 'success',
          css: 'color: #fff; background-color:#28a745'
        },
        danger: {
          name: 'danger',
          description: 'danger',
          css: 'color: #fff; background-color: #dc3545'
        },
        warning: {
          name: 'warning',
          description: 'warning',
          css: 'color: #fff; background-color: #ffc107'
        },
        info: {
          name: 'info',
          description: 'info',
          css: 'color: #fff; background-color: #17a2b8'
        },
        light: {
          name: 'light',
          description: 'light',
          css: 'color: #212529; background-color: #f8f9fa'
        },
        dark: {
          name: 'dark',
          description: 'dark',
          css: 'color: #fff; background-color: #1d2124'
        }
      }
    },
    width: {
      name: 'Width',
      description: 'Width',
      classes: {
        s: {
          name: 'Small',
          description: 'small',
          css: 'width:25%'
        },
        m: {
          name: 'Medium',
          description: 'Medium',
          css: 'width:50%'
        },
        l: {
          name: 'Large',
          description: 'Large',
          css: 'width:100%'
        }
      }
    },
    boxAlign: {
      name: 'Box Alignment',
      description: 'boxAlign',
      classes: {
        Left: {
          name: 'Float Left',
          description: 'Left',
          css: 'float:left'
        },
        Right: {
          name: 'Float Right',
          description: 'Large',
          css: 'float:right'
        }
      }
    },
    display: {
      name: 'display',
      description: 'display',
      classes: {
        inline: {
          name: 'inline',
          description: 'inline',
          css: 'display: inline'
        },
        block: {
          name: 'block',
          description: 'block',
          css: 'display: block'
        },
        flex: {
          name: 'flex',
          description: 'flex',
          css: 'display: flex'
        }
      }
    },
    flexJustifyContent: {
      init: (styleFwPropClass, style, state) => {
        //console.log('flexJustifyContent', {styleFwPropClass, style, state})
        return state.display === 'flex' ? styleFwPropClass : false
      },
      name: 'flexJustifyContent',
      description: 'flexJustifyContent',
      classes: {
        start: {
          name: 'start',
          description: 'start',
          css: 'justify-content:flex-start'
        },
        end: {
          name: 'end',
          description: 'end',
          css: 'justify-content:flex-end'
        },
        center: {
          name: 'center',
          description: 'center',
          css: 'justify-content:center'
        },
        spaceBetween: {
          name: 'space-between',
          description: 'space-between',
          css: 'justify-content:space-between'
        },
        spaceAround: {
          name: 'space-around',
          description: 'space-around',
          css: 'justify-content:space-around'
        },
        spaceEvenly: {
          name: 'space-evenly',
          description: 'space-evenly',
          css: 'justify-content:space-evenly'
        }
      }
    },
    textAlign: {
      name: 'Text Alignment',
      description: 'textAlign',
      classes: {
        Left: {
          name: 'Left',
          description: 'Left',
          css: 'text-align:left'
        },
        Center: {
          name: 'Center',
          description: 'Medium',
          css: 'text-align:center'
        },
        Right: {
          name: 'Right',
          description: 'Large',
          css: 'text-align:right'
        },
        Justified: {
          name: 'Justified',
          description: 'Justified',
          css: 'text-align:justify'
        }
      }
    },
    height: {
      name: 'Height',
      description: 'Height',
      classes: {
        s: {
          name: 'Small',
          description: 'small',
          css: 'height:25%'
        },
        m: {
          name: 'Medium',
          description: 'Medium',
          css: 'height:50%'
        },
        l: {
          name: 'Large',
          description: 'Large',
          css: 'height:100%'
        }
      }
    }
  }
}
export default framework
