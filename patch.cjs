const fs = require("fs");
let content = fs.readFileSync("src/components/MapComponent.jsx", "utf8");

const importStr = "import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';\n";
if (!content.includes("react-zoom-pan-pinch")) {
  content = content.replace("import React,", importStr + "import React,");
}

const compStr = `
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
`;

if (!content.includes("ProgressiveFullscreenPhoto")) {
  content = content.replace("const MapComponent = (", compStr + "\nconst MapComponent = (");
}

const oldTarget = `{fullscreenPhoto === 'placeholder' ? (
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
            )}`;

const newTarget = `<ProgressiveFullscreenPhoto 
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
            />`;

const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patternStr = escapeRegExp(oldTarget).replace(/\\s\+/g, '\\s+').replace(/\s+/g, '\\s+');
const regex = new RegExp(patternStr);

if (regex.test(content)) {
  content = content.replace(regex, newTarget);
  fs.writeFileSync("src/components/MapComponent.jsx", content);
  console.log("Success");
} else {
  console.log("Pattern not matched!");
}
