import { lazy, Suspense } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom"; // <-- HashRouter
import { Navbar } from "@components/Navbar";
import { Layout } from "@components/Layout";
import { WalletProvider } from "@/context/WalletContext";
import { BalanceProviderWrapper } from "@components/BalanceProviderWrapper";
import { ToastContainer } from 'react-toastify';
import { ContractsProvider } from "@/context/ContractsContext";
import 'react-toastify/dist/ReactToastify.css';

const Home = lazy(() => import("@pages/Home").then(({ Home }) => ({ default: Home })));
const PickAChance = lazy(() => import("@pages/PickAChance").then(({ PickAChance }) => ({ default: PickAChance })));
const About = lazy(() => import("@pages/About").then(({ About }) => ({ default: About })));
const ItemShop = lazy(() => import("@pages/ItemShop").then(({ ItemShop }) => ({ default: ItemShop })));
const MyItems = lazy(() => import("@pages/MyItems").then(({ MyItems }) => ({ default: MyItems })));
const History = lazy(() => import("@pages/History").then(({ History }) => ({ default: History })));

function App() {
  return (
    <>
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <ContractsProvider>
        <WalletProvider>
          <BalanceProviderWrapper>
            <Router>
              <Navbar />
              <Suspense fallback={null}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route
                    path="/pick-a-chance"
                    element={
                      <Layout showGamesSidebar={true}>
                        <PickAChance />
                      </Layout>
                    }
                  />
                  <Route
                    path="/about"
                    element={
                      <Layout showGamesSidebar={true}>
                        <About />
                      </Layout>
                    }
                  />
                  <Route
                    path="/item-shop"
                    element={
                      <Layout showGamesSidebar={true}>
                        <ItemShop />
                      </Layout>
                    }
                  />
                  <Route
                    path="/my-items"
                    element={
                      <Layout showGamesSidebar={true}>
                        <MyItems />
                      </Layout>
                    }
                  />
                  <Route
                    path="/history"
                    element={
                      <Layout showGamesSidebar={true}>
                        <History />
                      </Layout>
                    }
                  />
                </Routes>
              </Suspense>
            </Router>
          </BalanceProviderWrapper>
        </WalletProvider>
      </ContractsProvider>
    </>
  );
}

export default App;
