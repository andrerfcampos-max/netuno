import os

with open('src/components/MapComponent.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

import_str = "import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';\n"
if 'react-zoom-pan-pinch' not in content:
    content = content.replace('import React,', import_str + 'import React,', 1)

comp_str = """
const ProgressiveFullscreenPhoto = ({ photoUrl, placeholderContent }) => {
  const [hdSrc, setHdSrc] = React.useState(null);

  React.useEffect(() => {
    if (photoUrl === 'placeholder' || !photoUrl) return;

    let hdUrl = photoUrl;
    if (photoUrl.includes('.jpeg')) hdUrl = photoUrl.replace('.jpeg', '_hd.jpeg');
    else if (photoUrl.includes('.jpg')) hdUrl = photoUrl.replace('.jpg', '_hd.jpg');
    else if (photoUrl.includes('.webp')) hdUrl = photoUrl.replace('.webp', '_hd.webp');
    else hdUrl = photoUrl + '_hd';

    const img = new Image();
    img.src = hdUrl;
    img.onload = () => setHdSrc(hdUrl);
    img.onerror = () => setHdSrc(null);
  }, [photoUrl]);

  if (photoUrl === 'placeholder') return placeholderContent;

  return (
    <TransformWrapper initialScale={1} minScale={0.5} maxScale={5} centerOnInit wheel={{ step: 0.1 }}>
      <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={hdSrc || photoUrl} alt="Foto Ampliada" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-slate-800" onClick={(e) => e.stopPropagation()} />
      </TransformComponent>
    </TransformWrapper>
  );
};
"""

if 'ProgressiveFullscreenPhoto' not in content:
    content = content.replace('const MapComponent =', comp_str + '\nconst MapComponent =', 1)

old_target = """{fullscreenPhoto === 'placeholder' ? (
              <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-900/60 rounded-2xl border border-slate-800 max-w-sm w-full">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-slate-700">
                  <MapPin size={24} className="text-slate-500" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Foto não capturada</h3>
                <p className="text-slate-400 text-sm">
                  Este hidrante ainda não possui uma foto de perfil ou a captura automática falhou. 
                  Você pode usar o botão do Street View abaixo para explorar a área com o enquadramento calibrado.
                </p>
              </div>
            ) : (
              <img 
                src={fullscreenPhoto} 
                alt="Foto Ampliada do Hidrante" 
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-slate-800" 
                onClick={(e) => e.stopPropagation()}
              />
            )}"""

new_target = """<ProgressiveFullscreenPhoto 
              photoUrl={fullscreenPhoto} 
              placeholderContent={
                <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-900/60 rounded-2xl border border-slate-800 max-w-sm w-full">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-slate-700">
                    <MapPin size={24} className="text-slate-500" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">Foto não capturada</h3>
                  <p className="text-slate-400 text-sm">
                    Este hidrante ainda não possui uma foto de perfil ou a captura automática falhou. 
                    Você pode usar o botão do Street View abaixo para explorar a área com o enquadramento calibrado.
                  </p>
                </div>
              } 
            />"""

# Remove whitespace to match easily
import re
def normalize_ws(s):
    return re.sub(r'\s+', ' ', s)

import sys

content_norm = normalize_ws(content)
old_target_norm = normalize_ws(old_target)

# print if old target is found
if old_target_norm not in content_norm:
    print("Old target not found!")

# Instead of direct string replace, let's use regex with variable whitespace
pattern = re.escape(old_target)
pattern = re.sub(r'\\s\+', r'\\s+', re.sub(r'\s+', r'\\s+', old_target))

# Check if pattern matches
match = re.search(pattern, content)
if match:
    content = content[:match.start()] + new_target + content[match.end():]
    with open('src/components/MapComponent.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Success')
else:
    print('Pattern not matched in file')

