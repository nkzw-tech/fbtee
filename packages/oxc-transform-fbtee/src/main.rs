fn main() {
    if let Err(error) = oxc_transform_fbtee::native_cli::run() {
        eprintln!("Error: {error}");
        std::process::exit(1);
    }
}
