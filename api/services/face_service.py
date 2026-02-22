"""
==========================================================
FACE SERVICE - Yüz Algılama ve Baş Pozisyonu Tahmini
==========================================================

Bu servis, MediaPipe Face Mesh kullanarak:
1. Yüz algılama
2. Baş yönü tespiti (sol/sağ/merkez)  
3. Yüz boyutu hesaplama (yakınlık kontrolü için)

Challenge Mantığı:
- CENTER: Yüz boyutu >= %12 → Kullanıcı yaklaştığında geçer
- LEFT:   Yaw < -10° → Başını sola çevirince geçer
- RIGHT:  Yaw > +10° → Başını sağa çevirince geçer

Mock Mode: MediaPipe yoksa simüle edilmiş veri döner
==========================================================
"""

import cv2
import numpy as np
import os
import random

# ============================================
# MediaPipe Import - Birden fazla yöntem dener
# ============================================
MEDIAPIPE_AVAILABLE = False
mp_face_mesh = None

try:
    # Yöntem 1: Standart import
    import mediapipe as mp
    mp_face_mesh = mp.solutions.face_mesh
    MEDIAPIPE_AVAILABLE = True
except (ImportError, AttributeError):
    try:
        # Yöntem 2: Direkt import (Python 3.12+ uyumluluğu)
        from mediapipe.python.solutions import face_mesh as mp_face_mesh
        MEDIAPIPE_AVAILABLE = True
    except ImportError:
        print("[WARNING] MediaPipe not available. Using mock face detection.")
        MEDIAPIPE_AVAILABLE = False
        mp_face_mesh = None


class FaceService:
    """""""""
    Yüz algılama ve baş pozisyonu tahmini servisi
    
    Özellikler:
    - Yüz yönü tespiti (yaw açısı)
    - Yüz boyutu hesaplama (proximity/yakınlık)
    - Yüz kaydetme ve eşleştirme
    """

    def __init__(self, face_db_dir: str):
        """
        FaceService başlatıcı
        
        Args:
            face_db_dir: Yüz resimlerinin kaydedileceği klasör
        """
        self.face_db_dir = face_db_dir
        os.makedirs(face_db_dir, exist_ok=True)
        self.use_mock = not MEDIAPIPE_AVAILABLE
        
        if MEDIAPIPE_AVAILABLE:
            # MediaPipe FaceMesh - tek seferlik oluşturulur (performans için)
            self.face_mesh = mp_face_mesh.FaceMesh(
                static_image_mode=True,      # Her frame bağımsız işlenir
                max_num_faces=1,             # Sadece 1 yüz algıla
                refine_landmarks=True,       # Detaylı landmark'lar
                min_detection_confidence=0.6,
                min_tracking_confidence=0.6
            )
        else:
            self.face_mesh = None
            print("[FaceService] MOCK modunda çalışıyor - gerçek yüz algılama yok")

    def detect_direction(self, img: np.ndarray) -> dict:
        """
        Yüz yönünü ve boyutunu tespit et
        
        Args:
            img: OpenCV görüntüsü (BGR format)
            
        Returns:
            {
                detected: bool,      # Yüz bulundu mu
                direction: str,      # "center" | "left" | "right"
                confidence: float,   # 0-1 arası güven skoru
                yaw: float,          # Baş açısı (derece)
                face_size: float     # Yüz boyutu (frame oranı)
            }
        """
        # ============================================
        # Girdi Doğrulama
        # ============================================
        if img is None or img.size == 0:
            return self._error("Invalid image")

        if len(img.shape) != 3 or img.shape[2] != 3:
            return self._error("Invalid image format")

        h, w, _ = img.shape
        if h < 100 or w < 100:
            return self._error("Image too small")

        # ============================================
        # MOCK MODE - MediaPipe yokken simülasyon
        # Demo/test için kullanılır
        # ============================================
        if self.use_mock:
            directions = ["center", "center", "center", "left", "right"]
            direction = random.choice(directions)
            confidence = random.uniform(0.85, 0.98)
            face_size = random.uniform(0.15, 0.35)  # %15-35 arası yüz boyutu
            yaw = 0.0 if direction == "center" else (
                random.uniform(-35, -25) if direction == "left" else random.uniform(25, 35)
            )
            return {
                "detected": True,
""                "direction": direction,
                "confidence": round(confidence, 3),
                "yaw": round(yaw, 2),
                "face_size": round(face_size, 3)
            }

        # ============================================
        # GERÇEK YÜZ ALGILAMA - MediaPipe ile
        # ============================================
        try:
            # BGR -> RGB dönüşümü (MediaPipe RGB bekler)
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            results = self.face_mesh.process(img_rgb)

            if not results.multi_face_landmarks:
                return self._error("No face detected")

            landmarks = results.multi_face_landmarks[0]

            # ----------------------------------------
            # YÜZ BOYUTU HESAPLAMA
            # Bounding box / frame oranı
            # CENTER challenge için kullanılır
            # ----------------------------------------
            xs = [lm.x for lm in landmarks.landmark]
            ys = [lm.y for lm in landmarks.landmark]
            face_width = max(xs) - min(xs)
            face_height = max(ys) - min(ys)
            face_size = face_width * face_height  # Frame oranı olarak

            # ----------------------------------------
            # BAŞ YÖNÜ TAHMİNİ (Head Pose Estimation)
            # PnP algoritması ile 3D -> 2D projeksiyon
            # ----------------------------------------
            
            # Önemli landmark noktaları (burun, göz köşeleri, ağız)
            landmark_ids = [33, 263, 1, 61, 291, 199]
            face_2d = []
            face_3d = []

            for idx in landmark_ids:
                lm = landmarks.landmark[idx]
                x, y = int(lm.x * w), int(lm.y * h)
                face_2d.append([x, y])
                face_3d.append([x, y, lm.z * 3000])  # Z derinliği ölçeklendi

            face_2d = np.array(face_2d, dtype=np.float64)
            face_3d = np.array(face_3d, dtype=np.float64)

            # Kamera matrisi (varsayılan değerler)
            focal_length = w
            cam_matrix = np.array([
                [focal_length, 0, w / 2],
                [0, focal_length, h / 2],
                [0, 0, 1]
            ], dtype=np.float64)

            dist_matrix = np.zeros((4, 1), dtype=np.float64)

            # PnP çözümü - rotasyon vektörü bul
            success, rot_vec, _ = cv2.solvePnP(
                face_3d,
                face_2d,
                cam_matrix,
                dist_matrix,
                flags=cv2.SOLVEPNP_ITERATIVE
            )

            if not success:
                return self._error("Pose estimation failed")

            # Rotasyon matrisinden Euler açılarını çıkar
            rmat, _ = cv2.Rodrigues(rot_vec)
            angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)

            # YAW açısı (sağ-sol dönüş)
            yaw_deg = float(angles[1])
            print(f"[DEBUG] Yaw: {yaw_deg:.2f}°")

            # ----------------------------------------
            # YÖN BELİRLEME
            # Düşük threshold = hızlı tepki
            # ----------------------------------------
            threshold = 10  # ±10° sol/sağ tetikler
            
            if yaw_deg < -threshold:
                direction = "left"      # Sola bakıyor
            elif yaw_deg > threshold:
                direction = "right"     # Sağa bakıyor
            else:
                direction = "center"    # Merkeze bakıyor

            # Confidence hesaplama
            if direction == "center":
                # Merkeze ne kadar yakınsa o kadar yüksek
                confidence = max(0.75, 1 - abs(yaw_deg) / threshold)
            else:
                # Yöne ne kadar dönmüşse o kadar yüksek
                confidence = min(1.0, 0.6 + (abs(yaw_deg) - threshold) / 20)

            return {
                "detected": True,
                "direction": direction,
                "confidence": round(confidence, 3),
                "yaw": round(yaw_deg, 2),
                "face_size": round(face_size, 3)
            }

        except Exception as e:
            return self._error(str(e))

    def register_face(self, user_id: str, img: np.ndarray) -> dict:
        """
        Kullanıcı yüzünü kaydet
        
        Args:
            user_id: Kullanıcı ID'si
            img: Yüz görüntüsü
        """
        if not user_id or not isinstance(user_id, str):
            return {"success": False, "message": "Invalid user_id"}

        if img is None or img.size == 0:
            return {"success": False, "message": "Invalid image"}

        # Güvenli dosya adı oluştur
        safe_user_id = "".join(c for c in user_id if c.isalnum() or c in "-_")
        if not safe_user_id:
            return {"success": False, "message": "Invalid user_id format"}

        path = os.path.join(self.face_db_dir, f"{safe_user_id}.jpg")

        try:
            success = cv2.imwrite(path, img)
            if success:
                return {"success": True, "message": "Face registered successfully"}
            return {"success": False, "message": "Failed to save image"}

        except Exception as e:
            return {"success": False, "message": str(e)}

    def find_face(self, img: np.ndarray) -> dict:
        """
        Yüz eşleştirme (Placeholder)
        TODO: DeepFace veya face embedding ile gerçek eşleştirme
        """
        files = [f for f in os.listdir(self.face_db_dir) if f.endswith(".jpg")]

        if not files:
            return {"found": False}

        return {
            "found": True,
            "user_id": files[0].replace(".jpg", ""),
            "confidence": 0.8
        }

    def get_registered_count(self) -> int:
        """Kayıtlı yüz sayısını döndür"""
        return len([f for f in os.listdir(self.face_db_dir) if f.endswith(".jpg")])

    def _error(self, message: str) -> dict:
        """Hata response'u oluştur"""
        return {
            "detected": False,
            "direction": "none",
            "confidence": 0,
            "yaw": 0.0,
            "error": message
        }
