fn main() {
    napi_build::setup();

    let package: serde_json::Value =
        serde_json::from_str(include_str!("package.json")).expect("invalid compiler package.json");
    let version = package["version"]
        .as_str()
        .expect("missing compiler package.json version");
    println!("cargo::rustc-env=FBTEE_VERSION={version}");
}
