const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname,'..')
const modules = new Map()
module.exports = function loadTs(file, extra={}) {
  const absolute=path.resolve(root,file)
  if(modules.has(absolute)&&!Object.keys(extra).length)return modules.get(absolute)
  const module={exports:{}}
  const code=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  const localRequire=(name)=>{
    if(name.startsWith('.')||name.startsWith('@/')) {
      const target=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(absolute),name)
      if(target.endsWith('.json'))return require(target)
      return loadTs(path.relative(root,target.endsWith('.ts')?target:target+'.ts'))
    }
    return require(name)
  }
  if(Object.keys(extra).length) vm.runInNewContext(code,{module,exports:module.exports,require:localRequire,console,URL,Response,Request,Headers,Blob,DOMException,setTimeout,clearTimeout,crypto:globalThis.crypto,...extra},{filename:absolute})
  else vm.runInThisContext('(function(exports,require,module){'+code+'\n})',{filename:absolute})(module.exports,localRequire,module)
  if(!Object.keys(extra).length)modules.set(absolute,module.exports)
  return module.exports
}
