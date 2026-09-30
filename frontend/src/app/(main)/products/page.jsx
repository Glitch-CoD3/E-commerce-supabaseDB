import { Suspense } from "react";
import ProductList from "../../../components/ProductList.jsx";

const ProductPage = async ({ searchParams }) => {
  const { category } = await searchParams;

  return (
    <Suspense fallback={<p className="text-center py-16">Loading...</p>}>
      <ProductList category={category} params="products" />
    </Suspense>
  );
};

export default ProductPage;