var dotEnv = require('dotenv');
var fs = require('fs');
var sysPath = require('path');
var process = require('process');

var environmentCopy = Object.assign({}, process.env)

module.exports = function (data) {
    var t = data.types;

    return {
        visitor: {
            ImportDeclaration: function(path, state) {
                var options = state.opts;

                if (options.replacedModuleName === undefined)
                  return;

                var configDir = options.configDir ? options.configDir : './';
                var configFile = options.filename ? options.filename : '.env';

                if (path.node.source.value === options.replacedModuleName) {
                  var config = dotEnv.config({ path: sysPath.join(configDir, configFile), silent: true }) || {};
                  var platformPath = (process.env.BABEL_ENV === 'development' || process.env.BABEL_ENV === undefined)
                                          ? configFile + '.development'
                                          : configFile + '.production';
                  var config = Object.assign(config, dotEnv.config({ path: sysPath.join(configDir, platformPath), silent: true }));

                  path.node.specifiers.forEach(function(specifier, idx){
                    if (specifier.type === "ImportDefaultSpecifier") {
                      throw path.get('specifiers')[idx].buildCodeFrameError('Import dotenv as default is not supported.')
                    }
                    var importedId = specifier.imported.name
                    var localId = specifier.local.name;
                    if(!(config.hasOwnProperty(importedId)) && !environmentCopy.hasOwnProperty(importedId)) {
                      throw path.get('specifiers')[idx].buildCodeFrameError(
                        'Try to import dotenv variable "'
                        + importedId
                        + '" which is not defined in any '
                        + configFile
                        + ' files or as an environment variable.'
                      )
                    }

                    var binding = path.scope.getBinding(localId);
                    binding.referencePaths.forEach(function(refPath){
                      refPath.replaceWith(t.valueToNode(environmentCopy[importedId] || config[importedId]))
                    });
                  })

                  path.remove();
                }
            }
        }
    }
}
