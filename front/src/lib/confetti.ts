type ConfettiOptions = {
  particleCount: number;
  angle: number;
  spread: number;
  origin: { x: number };
  colors: string[];
};

type Particle = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
};

const DURATION_MS = 15 * 10;
const COLORS = ['#006FFF', '#ffffff'];

function addParticles(
  particles: Particle[],
  canvas: HTMLCanvasElement,
  { particleCount, angle, spread, origin, colors }: ConfettiOptions,
) {
  const radians = (angle * Math.PI) / 180;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const originX = (canvas.width / devicePixelRatio) * origin.x;

  for (let index = 0; index < particleCount; index += 1) {
    const direction = radians + ((Math.random() - 0.5) * spread * Math.PI) / 180;
    const speed = 5 + Math.random() * 2;
    particles.push({
      x: originX,
      y: (canvas.height / devicePixelRatio) * 0.55,
      velocityX: Math.cos(direction) * speed,
      velocityY: -Math.sin(direction) * speed,
      color: colors[index % colors.length],
      size: 4 + Math.random() * 4,
      rotation: Math.random() * Math.PI,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
    });
  }
}

function drawParticles(context: CanvasRenderingContext2D, particles: Particle[]) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  particles.forEach((particle) => {
    context.save();
    context.translate(particle.x, particle.y);
    context.rotate(particle.rotation);
    context.fillStyle = particle.color;
    context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
    context.restore();

    particle.x += particle.velocityX;
    particle.y += particle.velocityY;
    particle.velocityY += 0.18;
    particle.rotation += particle.rotationSpeed;
  });
}

function confetti(canvas: HTMLCanvasElement, particles: Particle[], options: ConfettiOptions) {
  addParticles(particles, canvas, options);
}

export function celebrateBadgeAcquisition() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!window.matchMedia('(min-width: 769px)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;

  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  canvas.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999';
  context.scale(devicePixelRatio, devicePixelRatio);
  document.body.appendChild(canvas);

  const particles: Particle[] = [];
  const end = Date.now() + DURATION_MS;
  const frame = () => {
    confetti(canvas, particles, {
      particleCount: 2,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: COLORS,
    });
    confetti(canvas, particles, {
      particleCount: 2,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: COLORS,
    });
    drawParticles(context, particles);

    if (Date.now() < end) {
      window.requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  };

  window.requestAnimationFrame(frame);
}
