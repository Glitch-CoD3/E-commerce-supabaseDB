import ProductList from "../../../components/ProductList";

const ProductPage = async ({searchParams}) => {
  const category = (await searchParams).category;
    return (
        <div className="">
            <ProductList category={category} params="products"/>
        </div>
    )
}

export default ProductPage;