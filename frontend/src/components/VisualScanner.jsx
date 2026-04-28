// frontend/src/components/VisualScanner.jsx
import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";

// Import dinámico para knn-classifier
let knnClassifier = null;

const VisualScanner = ({ products, onProductFound, onClose }) => {
  const [step, setStep] = useState("training");
  const [trainingClass, setTrainingClass] = useState(null);
  const [trainingCount, setTrainingCount] = useState({});
  const [status, setStatus] = useState("Iniciando cámara...");
  const [modelLoaded, setModelLoaded] = useState(false);

  const videoRef = useRef(null);
  const netRef = useRef(null);
  const classifierRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        setStatus("Cargando modelo de IA...");

        // Cargar knnClassifier dinámicamente
        const knnModule = await import("@tensorflow-models/knn-classifier");
        knnClassifier = knnModule;

        await tf.ready();
        netRef.current = await mobilenet.load();
        classifierRef.current = knnClassifier.create();
        setModelLoaded(true);
        setStatus("Modelo listo. Iniciando cámara...");
        startCamera();
      } catch (error) {
        console.error("Error cargando modelo:", error);
        setStatus("Error al cargar el modelo. Reintentando...");
        setTimeout(init, 3000);
      }
    };
    init();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("Cámara lista. Comienza a entrenar el modelo.");
      }
    } catch (err) {
      console.error("Error al acceder a la cámara:", err);
      setStatus("Error: No se pudo acceder a la cámara");
    }
  };

  const trainWithCurrentImage = async (productId) => {
    if (!videoRef.current || !netRef.current || !classifierRef.current) return;

    const product = products.find((p) => p.id === productId);
    setStatus(`📸 Capturando imagen para ${product?.name}...`);

    try {
      const img = tf.browser.fromPixels(videoRef.current);
      const activation = netRef.current.infer(img, true);
      classifierRef.current.addExample(activation, String(productId));

      img.dispose();
      activation.dispose();

      setTrainingCount((prev) => ({
        ...prev,
        [productId]: (prev[productId] || 0) + 1,
      }));

      setStatus(
        `✅ Aprendido! ${(trainingCount[productId] || 0) + 1}/10 capturas`,
      );
    } catch (error) {
      console.error("Error entrenando:", error);
      setStatus("Error al capturar. Intenta de nuevo.");
    }
  };

  const startScanning = () => {
    setStep("scanning");
    setStatus("🔍 Escaneando... muestra el producto a la cámara");

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !netRef.current || !classifierRef.current)
        return;

      try {
        const img = tf.browser.fromPixels(videoRef.current);
        const activation = netRef.current.infer(img, "conv_preds");
        const result = await classifierRef.current.predictClass(activation);

        img.dispose();
        activation.dispose();

        if (result && result.confidences[result.label] > 0.7) {
          const productId = parseInt(result.label);
          const product = products.find((p) => p.id === productId);
          const confidence = Math.round(result.confidences[result.label] * 100);

          if (product) {
            setStatus(
              `🎯 Detectado: ${product.name} (${confidence}% confianza)`,
            );
            clearInterval(intervalRef.current);
            onProductFound(product);
          }
        } else if (result) {
          const bestMatch = Object.entries(result.confidences).sort(
            (a, b) => b[1] - a[1],
          )[0];
          if (bestMatch) {
            const product = products.find(
              (p) => p.id === parseInt(bestMatch[0]),
            );
            if (product) {
              setStatus(
                `🤔 Parece ${product.name} (${Math.round(bestMatch[1] * 100)}% confianza)`,
              );
            }
          }
        }
      } catch (err) {
        console.error("Error en escaneo:", err);
      }
    }, 500);
  };

  const trainMultipleAngles = (productId) => {
    const product = products.find((p) => p.id === productId);
    setTrainingClass(productId);
    setStatus(`📸 Entrenando para: ${product?.name}`);
    setTrainingCount((prev) => ({ ...prev, [productId]: 0 }));
  };

  const captureForTraining = () => {
    if (trainingClass !== null) {
      trainWithCurrentImage(trainingClass);
    }
  };

  const finishTraining = () => {
    if (trainingClass !== null) {
      const count = trainingCount[trainingClass] || 0;
      if (count < 5) {
        alert(
          `⚠️ Solo has capturado ${count} imágenes. Se recomiendan al menos 5-10 imágenes.`,
        );
      }
      setTrainingClass(null);
      setStep("scanning");
      startScanning();
    }
  };

  if (!modelLoaded) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 text-center max-w-md">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">
            Cargando modelo de inteligencia artificial...
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Esto puede tomar unos segundos la primera vez
          </p>
          <p className="text-xs text-gray-400 mt-4">{status}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 text-white">
          <h3 className="text-lg font-bold">
            {step === "training"
              ? "📸 Entrenar Reconocimiento Visual"
              : "🔍 Escanear Producto"}
          </h3>
          <p className="text-sm opacity-90">{status}</p>
        </div>

        <div className="relative bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-80 object-cover"
          />
          <div className="absolute bottom-2 left-0 right-0 text-center">
            <div className="inline-block bg-black bg-opacity-70 text-white text-xs px-3 py-1 rounded-full">
              {step === "training"
                ? "📸 Enfoca el producto para entrenar"
                : "🔍 Enfoca el producto a escanear"}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
          {step === "training" ? (
            <>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {products
                  .filter((p) => p.stock > 0)
                  .slice(0, 20)
                  .map((product) => (
                    <button
                      key={product.id}
                      onClick={() => trainMultipleAngles(product.id)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        trainingClass === product.id
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-200 hover:border-purple-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-sm overflow-hidden">
                          {product.image_url ? (
                            <img
                              src={`${import.meta.env.VITE_API_URL || "http://localhost:3000"}${product.image_url}`}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            "📦"
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {product.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {trainingCount[product.id] || 0} capturas
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>

              {trainingClass !== null && (
                <div className="space-y-2">
                  <button
                    onClick={captureForTraining}
                    className="w-full py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                  >
                    📸 Capturar imagen ({trainingCount[trainingClass] || 0}/10+)
                  </button>
                  <button
                    onClick={finishTraining}
                    className="w-full py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors"
                  >
                    ✅ Terminar entrenamiento y escanear
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-center text-gray-600 text-sm">
                Muestra el producto frente a la cámara. El sistema lo reconocerá
                automáticamente.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    onClose();
                  }}
                  className="flex-1 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>

        <div className="bg-gray-50 p-3 text-xs text-gray-500 border-t">
          {step === "training" ? (
            <p>
              💡 <strong>Consejo:</strong> Toma fotos desde diferentes ángulos.
              10-15 fotos por producto dan mejor resultado.
            </p>
          ) : (
            <p>
              💡 <strong>Consejo:</strong> Asegura buena iluminación y enfoca
              bien el producto.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisualScanner;
