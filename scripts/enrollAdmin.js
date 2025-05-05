const { Wallets, Gateway } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const fs = require('fs');

const ccpPath = '/home/paystack/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json';

const walletPath = path.join(__dirname, 'wallet');

async function enrollAdmin() {
    try {
        // Load the network configuration
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create a new CA client for interacting with the CA
        const caURL = ccp.certificateAuthorities['ca.org1.example.com'].url;
        const ca = new FabricCAServices(caURL);

        // Create a new file system-based wallet
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`💼 Wallet path: ${walletPath}`);

        // Check if admin already exists
        const adminIdentity = await wallet.get('admin');
        if (adminIdentity) {
            console.log('✅ Admin identity already exists in the wallet');
            return;
        }

        // Enroll the admin user and import the identity into the wallet
        const enrollment = await ca.enroll({
            enrollmentID: 'admin',
            enrollmentSecret: 'adminpw'
        });

        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };

        await wallet.put('admin', x509Identity);
        console.log('✅ Successfully enrolled admin and imported it into the wallet');
    } catch (error) {
        console.error('❌ Failed to enroll admin:', error);
    }
}

enrollAdmin();
