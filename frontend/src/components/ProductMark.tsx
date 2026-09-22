import Image from "next/image";

export default function ProductMark() {
  return (
    <span className="product-mark" aria-hidden="true">
      <Image src="/brand/n-dark.svg" alt="Nalar Protocol" width={20} height={20} className="brand-logo-dark" />
      <Image src="/brand/n-light.svg" alt="Nalar Protocol" width={20} height={20} className="brand-logo-light" />
    </span>
  );
}
