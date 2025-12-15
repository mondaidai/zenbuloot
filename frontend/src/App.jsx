// App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Navbar } from "@components/Navbar";
import { Home } from "@pages/Home";
import { PickAChance } from "@pages/PickAChance";
import { About } from "@pages/About";
import { ItemShop } from "@pages/ItemShop";
import { MyItems } from "@pages/MyItems";
import { Layout } from "@components/Layout";
import { WalletProvider } from "@/context/WalletContext";
import { BalanceProviderWrapper } from "@components/BalanceProviderWrapper";
import { ToastContainer, toast } from 'react-toastify';
import { History } from "@pages/History";
import { ContractsProvider } from "@/context/ContractsContext";
import 'react-toastify/dist/ReactToastify.css';

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
          <BalanceProviderWrapper> {/* Use the wrapper instead of ContractBalanceProvider directly */}
            <Router>
              <Navbar />
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
            </Router>
          </BalanceProviderWrapper>
        </WalletProvider>
      </ContractsProvider>
    </>
  );
}

export default App;